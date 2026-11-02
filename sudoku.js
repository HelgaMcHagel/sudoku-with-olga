(() => {
  const boardEl = document.getElementById("sudoku-board");
  const timerEl = document.getElementById("timer");
  const statusEl = document.getElementById("game-status");
  const mistakesEl = document.getElementById("mistake-count");
  const notesToggle = document.getElementById("notes-toggle");
  const numberButtons = [...document.querySelectorAll(".number-button")];

  let puzzle = [], solution = [], values = [], notes = [], selected = null;
  let notesMode = false, mistakes = 0, seconds = 0, timerId = null, history = [];
  let started = false;
  let celebrationTimer = null;
  let celebratedCells = new Set();
  let completedNumbers = new Set();
  let flashedNumbers = new Set();
  let digitFlashTimer = null;
  let difficulty = "easy";
  const difficultySettings = { easy: 36, medium: 46, hard: 52 };
  const difficultySelect = document.getElementById("difficulty-select");

  const copy = grid => grid.map(row => [...row]);
  const shuffle = arr => [...arr].sort(() => Math.random() - .5);
  const candidates = (grid, r, c) => {
    const used = new Set([...grid[r], ...grid.map(row => row[c])]);
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let y = br; y < br + 3; y++) for (let x = bc; x < bc + 3; x++) used.add(grid[y][x]);
    return [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n));
  };
  function fillGrid(grid) {
    let best = null, bestOptions = null;
    for (let r=0;r<9;r++) for (let c=0;c<9;c++) if (!grid[r][c]) {
      const opts = candidates(grid,r,c);
      if (!best || opts.length < bestOptions.length) { best=[r,c]; bestOptions=opts; }
      if (!opts.length) return false;
    }
    if (!best) return true;
    const [r,c] = best;
    for (const n of shuffle(bestOptions)) {
      grid[r][c]=n;
      if (fillGrid(grid)) return true;
      grid[r][c]=0;
    }
    return false;
  }
  function countSolutions(grid, limit=2) {
    let best=null, optsBest=null;
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(!grid[r][c]) {
      const opts=candidates(grid,r,c);
      if(!opts.length) return 0;
      if(!best || opts.length<optsBest.length) { best=[r,c]; optsBest=opts; }
    }
    if(!best) return 1;
    let count=0; const [r,c]=best;
    for(const n of optsBest) {
      grid[r][c]=n; count+=countSolutions(grid,limit-count); grid[r][c]=0;
      if(count>=limit) return count;
    }
    return count;
  }
  function makePuzzle() {
    const solved=Array.from({length:9},()=>Array(9).fill(0));
    fillGrid(solved);
    const p=copy(solved);
    // Remove a gentle number of clues while retaining exactly one solution.
    const positions=shuffle(Array.from({length:81},(_,i)=>i));
    let removed=0;
    for(const pos of positions) {
      if(removed>=difficultySettings[difficulty]) break;
      const r=Math.floor(pos/9), c=pos%9, old=p[r][c];
      p[r][c]=0;
      if(countSolutions(copy(p))!==1) p[r][c]=old;
      else removed++;
    }
    return {p, solved, removed};
  }
  function startTimer() {
    clearInterval(timerId);
    timerId=setInterval(()=>{ if(started) { seconds++; timerEl.textContent=formatTime(seconds); } },1000);
  }
  const formatTime = n => `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
  function completedUnits() {
    const units = [];
    for (let r=0;r<9;r++) {
      const cells = Array.from({length:9},(_,c)=>[r,c]);
      if (cells.every(([y,x])=>values[y][x]===solution[y][x])) units.push(cells);
    }
    for (let c=0;c<9;c++) {
      const cells = Array.from({length:9},(_,r)=>[r,c]);
      if (cells.every(([y,x])=>values[y][x]===solution[y][x])) units.push(cells);
    }
    for (let br=0;br<9;br+=3) for (let bc=0;bc<9;bc+=3) {
      const cells=[];
      for(let r=br;r<br+3;r++) for(let c=bc;c<bc+3;c++) cells.push([r,c]);
      if(cells.every(([y,x])=>values[y][x]===solution[y][x])) units.push(cells);
    }
    return units;
  }
  function celebrateNewUnits(before) {
    const previous = new Set(before.map(unit=>unit.map(([r,c])=>r*9+c).sort((a,b)=>a-b).join(",")));
    const newlyCompleted = completedUnits().filter(unit=>!previous.has(unit.map(([r,c])=>r*9+c).sort((a,b)=>a-b).join(",")));
    if (!newlyCompleted.length) return;
    newlyCompleted.forEach(unit=>unit.forEach(([r,c])=>celebratedCells.add(r*9+c)));
    clearTimeout(celebrationTimer);
    celebrationTimer=setTimeout(()=>{ celebratedCells.clear(); render(); },2100);
  }
  function findCompletedNumbers() {
    const result = new Set();
    for(let n=1;n<=9;n++) {
      let count=0, correct=true;
      for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(values[r][c]===n) {
        count++;
        if(solution[r][c]!==n) correct=false;
      }
      if(count===9 && correct) result.add(n);
    }
    return result;
  }
  function celebrateNewDigits(before) {
    const now=findCompletedNumbers();
    const newlyCompleted=[...now].filter(n=>!before.has(n));
    if(!newlyCompleted.length) return;
    newlyCompleted.forEach(n=>flashedNumbers.add(n));
    clearTimeout(digitFlashTimer);
    digitFlashTimer=setTimeout(()=>{ flashedNumbers.clear(); render(); },1800);
  }
  function newGame() {
    const generated=makePuzzle();
    puzzle=copy(generated.p); solution=copy(generated.solved); values=copy(puzzle);
    notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
    selected=null; mistakes=0; seconds=0; history=[]; started=true;
    clearTimeout(celebrationTimer); clearTimeout(digitFlashTimer);
    celebratedCells.clear(); completedNumbers.clear(); flashedNumbers.clear();
    document.getElementById("completion-scene").classList.remove("visible");
    timerEl.textContent="00:00"; mistakesEl.textContent="Mistakes: 0";
    statusEl.textContent=`A new ${difficulty} puzzle is ready.`;
    notesMode=false; notesToggle.setAttribute("aria-pressed","false");
    numberButtons.forEach(b=>b.classList.remove("active"));
    startTimer(); render();
  }
  function render() {
    completedNumbers=findCompletedNumbers();
    boardEl.innerHTML="";
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
      const n=values[r][c], cell=document.createElement("button");
      cell.type="button"; cell.className="cell"; cell.setAttribute("role","gridcell");
      cell.setAttribute("aria-label",`Row ${r+1}, column ${c+1}${n ? `, ${n}` : ", empty"}`);
      if(puzzle[r][c]) cell.classList.add("given");
      else if(n) cell.classList.add("user-entry");
      if(selected && selected[0]===r && selected[1]===c) cell.classList.add("selected");
      if(selected) {
        const [sr,sc]=selected;
        if((sr===r || sc===c || (Math.floor(sr/3)===Math.floor(r/3)&&Math.floor(sc/3)===Math.floor(c/3))) && !(sr===r&&sc===c)) cell.classList.add("peer");
        if(n && n===values[sr][sc]) cell.classList.add("same-number");
      }
      if(n && hasConflict(r,c,n)) cell.classList.add("conflict");
      if(n && flashedNumbers.has(n)) cell.classList.add("digit-flash");
      if(celebratedCells.has(r*9+c)) cell.classList.add("section-complete");
      if(n) cell.textContent=n;
      else if(notes[r][c].size) {
        const mini=document.createElement("span"); mini.className="notes-grid";
        for(let k=1;k<=9;k++){ const s=document.createElement("span"); s.textContent=notes[r][c].has(k)?k:""; mini.appendChild(s); }
        cell.appendChild(mini);
      }
      cell.addEventListener("click",()=>{ selected=[r,c]; render(); });
      boardEl.appendChild(cell);
    }
    completedNumbers=findCompletedNumbers();
    updateNumberPad();
  }
  function hasConflict(r,c,n) {
    for(let i=0;i<9;i++) if((i!==c&&values[r][i]===n)||(i!==r&&values[i][c]===n)) return true;
    const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
    for(let y=br;y<br+3;y++) for(let x=bc;x<bc+3;x++) if((y!==r||x!==c)&&values[y][x]===n) return true;
    return false;
  }
  function updateNumberPad() {
    numberButtons.forEach(btn=>{
      const n=Number(btn.dataset.number);
      btn.disabled=completedNumbers.has(n);
      btn.classList.remove("number-complete");
      btn.classList.toggle("digit-flash",flashedNumbers.has(n));
    });
  }
  function saveHistory() { history.push({values:copy(values),notes:notes.map(row=>row.map(s=>new Set(s))),mistakes}); }
  function enterNumber(n) {
    if(!selected) { statusEl.textContent="Choose an empty cell first."; return; }
    const [r,c]=selected;
    if(puzzle[r][c]) { statusEl.textContent="That number is part of the original puzzle."; return; }
    if(notesMode) {
      if(values[r][c]) return;
      saveHistory();
      if(notes[r][c].has(n)) notes[r][c].delete(n); else notes[r][c].add(n);
      render(); return;
    }
    if(values[r][c]===n) return;
    const beforeUnits=completedUnits();
    const beforeDigits=findCompletedNumbers();
    saveHistory();
    values[r][c]=n; notes[r][c].clear();
    if(n!==solution[r][c]) {
      mistakes++; mistakesEl.textContent=`Mistakes: ${mistakes}`;
      statusEl.textContent="Not quite. Take another look.";
    } else statusEl.textContent="Nice placement.";
    celebrateNewUnits(beforeUnits);
    celebrateNewDigits(beforeDigits);
    render();
    if(values.every((row,ri)=>row.every((v,ci)=>v===solution[ri][ci]))) {
      started=false; clearInterval(timerId);
      statusEl.textContent=`Beautifully done. You finished in ${formatTime(seconds)}.`;
      document.getElementById("completion-scene").classList.add("visible");
    }
  }
  function erase() {
    if(!selected) return;
    const [r,c]=selected;
    if(puzzle[r][c]) return;
    saveHistory(); values[r][c]=0; notes[r][c].clear(); render();
  }
  function undo() {
    const last=history.pop(); if(!last) return;
    values=last.values; notes=last.notes; mistakes=last.mistakes;
    mistakesEl.textContent=`Mistakes: ${mistakes}`;
    statusEl.textContent="Last move undone."; render();
  }
  function hint() {
    if(!selected) { statusEl.textContent="Choose a cell for a gentle hint."; return; }
    const [r,c]=selected;
    if(puzzle[r][c] || values[r][c]) { statusEl.textContent="Choose an empty cell."; return; }
    statusEl.textContent=`A little hint: this cell is ${solution[r][c]}.`;
  }
  numberButtons.forEach(btn=>btn.addEventListener("click",()=>enterNumber(Number(btn.dataset.number))));
  document.getElementById("erase-button").addEventListener("click",erase);
  document.getElementById("undo-button").addEventListener("click",undo);
  document.getElementById("hint-button").addEventListener("click",hint);
  difficultySelect.addEventListener("change",()=>{
    difficulty=difficultySelect.value;
    newGame();
  });
  document.getElementById("new-game-button").addEventListener("click",newGame);
  document.getElementById("reset-button").addEventListener("click",()=>{
    values=copy(puzzle); notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
    mistakes=0; seconds=0; started=true; history=[]; mistakesEl.textContent="Mistakes: 0";
    clearTimeout(celebrationTimer); clearTimeout(digitFlashTimer);
    celebratedCells.clear(); completedNumbers.clear(); flashedNumbers.clear();
    document.getElementById("completion-scene").classList.remove("visible");
    timerEl.textContent="00:00"; statusEl.textContent="Puzzle restarted."; startTimer(); render();
  });
  notesToggle.addEventListener("click",()=>{
    notesMode=!notesMode; notesToggle.setAttribute("aria-pressed",String(notesMode));
    statusEl.textContent=notesMode?"Notes mode is on.":"Number entry mode is on.";
  });
  document.addEventListener("keydown",e=>{
    if(e.key>="1"&&e.key<="9") enterNumber(Number(e.key));
    else if(e.key==="Backspace"||e.key==="Delete") erase();
    else if(e.key==="Escape") { selected=null; render(); }
    else if(e.key==="ArrowUp"||e.key==="ArrowDown"||e.key==="ArrowLeft"||e.key==="ArrowRight") {
      e.preventDefault();
      if(!selected) selected=[0,0];
      else {
        const [r,c]=selected;
        selected=[Math.max(0,Math.min(8,r+(e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0))),
                  Math.max(0,Math.min(8,c+(e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0)))];
      }
      render();
    }
  });
  newGame();
})();
