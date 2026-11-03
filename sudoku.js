(() => {
  const boardEl = document.getElementById("sudoku-board");
  const timerEl = document.getElementById("timer");
  const timerDisplay = document.getElementById("timer-display");
  const timerToggle = document.getElementById("timer-toggle");
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
  let randomSource = Math.random;
  const shuffle = arr => { const out=[...arr]; for(let i=out.length-1;i>0;i--){const j=Math.floor(randomSource()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
  const dailyModeButton = document.getElementById("daily-mode-button");
  const practiceModeButton = document.getElementById("practice-mode-button");
  const dailyMeta = document.getElementById("daily-meta");
  const dailyDateEl = document.getElementById("daily-date");
  const newGameButton = document.getElementById("new-game-button");
  const calendarDaysEl = document.getElementById("calendar-days");
  const calendarMonthEl = document.getElementById("calendar-month");
  const calendarPrevButton = document.getElementById("calendar-prev");
  const calendarNextButton = document.getElementById("calendar-next");
  const fullscreenButton = document.getElementById("fullscreen-button");
  const gameCard = document.querySelector(".game-card");
  let gameMode = "daily";
  const todayKey = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const dateFromKey = key => { const [y,m,d]=key.split("-").map(Number); return new Date(y,m-1,d); };
  let selectedDailyDate = todayKey();
  let calendarViewDate = new Date();
  const seedFromString = value => { let h=2166136261; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; };
  const seededRandom = seed => { let a=seed>>>0; return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; };
  const progressStorageKey = () => gameMode==="daily"
    ? "sudoku-with-olga-daily-"+selectedDailyDate
    : "sudoku-with-olga-practice-"+difficulty;
  function updateModeUI() {
    const daily=gameMode==="daily";
    dailyModeButton.classList.toggle("active",daily); practiceModeButton.classList.toggle("active",!daily);
    dailyModeButton.setAttribute("aria-pressed",String(daily)); practiceModeButton.setAttribute("aria-pressed",String(!daily));
    dailyMeta.hidden=!daily; difficultySelect.hidden=daily; newGameButton.hidden=daily;
    dailyDateEl.textContent=dateFromKey(selectedDailyDate).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  }
  function renderCalendar() {
    if(!calendarDaysEl)return;
    const year=calendarViewDate.getFullYear(), month=calendarViewDate.getMonth();
    calendarMonthEl.textContent=calendarViewDate.toLocaleDateString(undefined,{month:"long",year:"numeric"});
    const firstDay=new Date(year,month,1);
    const offset=(firstDay.getDay()+6)%7;
    const daysInMonth=new Date(year,month+1,0).getDate();
    const today=todayKey();
    calendarDaysEl.innerHTML="";
    for(let i=0;i<offset;i++){
      const blank=document.createElement("span"); blank.className="calendar-blank"; blank.setAttribute("aria-hidden","true"); calendarDaysEl.appendChild(blank);
    }
    for(let day=1;day<=daysInMonth;day++){
      const dateKey=todayKey(new Date(year,month,day));
      const button=document.createElement("button");
      button.type="button"; button.className="calendar-day"; button.textContent=day;
      button.setAttribute("aria-label",dateFromKey(dateKey).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}));
      if(dateKey===today)button.classList.add("today");
      if(dateKey===selectedDailyDate)button.classList.add("selected");
      if(dateKey>today){button.disabled=true;button.classList.add("future");}
      else {
        try {
          const saved=JSON.parse(localStorage.getItem("sudoku-with-olga-daily-"+dateKey)||"null");
          if(saved){button.classList.add(saved.completed?"completed":"played");}
        } catch(_){}
      }
      button.addEventListener("click",()=>{
        if(dateKey===selectedDailyDate&&gameMode==="daily")return;
        saveGameProgress();
        gameMode="daily"; selectedDailyDate=dateKey;
        calendarViewDate=new Date(year,month,1);
        newGame();
      });
      calendarDaysEl.appendChild(button);
    }
    const currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
    calendarPrevButton.disabled=year<2020;
    calendarNextButton.disabled=year===currentMonth.getFullYear()&&month>=currentMonth.getMonth() || calendarViewDate>currentMonth;
  }
  function saveGameProgress() {
    if(!values.length)return;
    try {
      localStorage.setItem(progressStorageKey(),JSON.stringify({
        puzzle,solution,values,notes:notes.map(row=>row.map(set=>[...set])),
        mistakes,seconds,completed:!started
      }));
      if(gameMode==="daily")renderCalendar();
    } catch (_) {}
  }
  function restoreGameProgress() {
    try {
      const raw=localStorage.getItem(progressStorageKey()); if(!raw)return false;
      const saved=JSON.parse(raw);
      const validGrid=grid=>Array.isArray(grid)&&grid.length===9&&grid.every(row=>Array.isArray(row)&&row.length===9);
      if(!validGrid(saved.puzzle)||!validGrid(saved.solution)||!validGrid(saved.values)||
         !Array.isArray(saved.notes)||saved.notes.length!==9)return false;
      puzzle=saved.puzzle.map(row=>row.map(Number));
      solution=saved.solution.map(row=>row.map(Number));
      values=saved.values.map(row=>row.map(Number));
      notes=saved.notes.map(row=>row.map(items=>new Set(items)));
      mistakes=Number(saved.mistakes)||0; seconds=Number(saved.seconds)||0; started=!saved.completed;
      mistakesEl.textContent="Mistakes: "+mistakes; timerEl.textContent=formatTime(seconds);
      statusEl.textContent=saved.completed
        ? (gameMode==="daily"?"Today's puzzle is complete. Well done.":"Practice puzzle completed. Well done.")
        : "Welcome back. Your puzzle is just as you left it.";
      if(saved.completed)document.getElementById("completion-scene").classList.add("visible");
      return true;
    } catch (_) { return false; }
  }
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
  function makePuzzle(seed=null) {
    const previousRandom=randomSource;
    if(seed!==null)randomSource=seededRandom(seed);
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
    randomSource=previousRandom;
    return {p, solved, removed};
  }
  function startTimer() {
    clearInterval(timerId);
    timerId=setInterval(()=>{ if(started) { seconds++; timerEl.textContent=formatTime(seconds); if(seconds%5===0)saveGameProgress(); } },1000);
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
  function newGame(forceNew=false) {
    updateModeUI();
    const daily=gameMode==="daily";
    difficulty=daily?"medium":difficultySelect.value;
    const generated=makePuzzle(daily?seedFromString("sudoku-with-olga-"+selectedDailyDate+"-medium"):null);
    puzzle=copy(generated.p); solution=copy(generated.solved); values=copy(puzzle);
    notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
    selected=null; mistakes=0; seconds=0; history=[]; started=true;
    clearTimeout(celebrationTimer); clearTimeout(digitFlashTimer);
    celebratedCells.clear(); completedNumbers.clear(); flashedNumbers.clear();
    document.getElementById("completion-scene").classList.remove("visible");
    timerEl.textContent="00:00"; mistakesEl.textContent="Mistakes: 0";
    statusEl.textContent=daily
      ? `Daily puzzle for ${dateFromKey(selectedDailyDate).toLocaleDateString(undefined,{month:"long",day:"numeric"})} is ready.`
      : `A new ${difficulty} puzzle is ready · ${81-generated.removed} starting clues.`;
    notesMode=false; notesToggle.setAttribute("aria-pressed","false");
    numberButtons.forEach(b=>b.classList.remove("active"));
    const restored=!forceNew&&restoreGameProgress();
    if(!restored){timerEl.textContent="00:00";mistakesEl.textContent="Mistakes: 0";}
    if(!started)clearInterval(timerId);else startTimer();
    render();
    renderCalendar();
    if(!restored)saveGameProgress();
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
      render(); saveGameProgress(); return;
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
    saveGameProgress();
  }
  function erase() {
    if(!selected) return;
    const [r,c]=selected;
    if(puzzle[r][c]) return;
    saveHistory(); values[r][c]=0; notes[r][c].clear(); render(); saveGameProgress();
  }
  function undo() {
    const last=history.pop(); if(!last) return;
    values=last.values; notes=last.notes; mistakes=last.mistakes; started=true;
    document.getElementById("completion-scene").classList.remove("visible");
    mistakesEl.textContent=`Mistakes: ${mistakes}`;
    statusEl.textContent="Last move undone."; startTimer(); render(); saveGameProgress();
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
  calendarPrevButton.addEventListener("click",()=>{
    calendarViewDate=new Date(calendarViewDate.getFullYear(),calendarViewDate.getMonth()-1,1);
    renderCalendar();
  });
  calendarNextButton.addEventListener("click",()=>{
    const next=new Date(calendarViewDate.getFullYear(),calendarViewDate.getMonth()+1,1);
    const current=new Date(new Date().getFullYear(),new Date().getMonth(),1);
    if(next<=current){calendarViewDate=next;renderCalendar();}
  });
  fullscreenButton.addEventListener("click",async()=>{
    try {
      if(!document.fullscreenElement) await gameCard.requestFullscreen();
      else await document.exitFullscreen();
    } catch(_){statusEl.textContent="Fullscreen is not available in this browser.";}
  });
  document.addEventListener("fullscreenchange",()=>{
    const active=document.fullscreenElement===gameCard;
    fullscreenButton.textContent=active?"⛶ Exit fullscreen":"⛶ Fullscreen";
    fullscreenButton.setAttribute("aria-label",active?"Exit fullscreen":"Enter fullscreen");
  });
  timerToggle.addEventListener("click",()=>{
    const visible = timerToggle.getAttribute("aria-pressed") !== "true";
    timerToggle.setAttribute("aria-pressed",String(visible));
    timerDisplay.hidden = !visible;
    timerToggle.textContent = visible ? "Hide timer" : "Show timer";
  });
  difficultySelect.addEventListener("change",()=>{
    saveGameProgress();
    difficulty=difficultySelect.value;
    newGame(true);
  });
  dailyModeButton.addEventListener("click",()=>{
    if(gameMode!=="daily"){saveGameProgress();gameMode="daily";newGame();}
  });
  practiceModeButton.addEventListener("click",()=>{
    if(gameMode!=="practice"){saveGameProgress();gameMode="practice";newGame();}
  });
  newGameButton.addEventListener("click",()=>newGame(true));
  document.getElementById("reset-button").addEventListener("click",()=>{
    values=copy(puzzle); notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
    mistakes=0; seconds=0; started=true; history=[]; mistakesEl.textContent="Mistakes: 0";
    clearTimeout(celebrationTimer); clearTimeout(digitFlashTimer);
    celebratedCells.clear(); completedNumbers.clear(); flashedNumbers.clear();
    document.getElementById("completion-scene").classList.remove("visible");
    timerEl.textContent="00:00"; statusEl.textContent="Puzzle restarted."; startTimer(); render(); saveGameProgress();
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
