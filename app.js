/**
 * 喵喵背单词 - 网页版
 * 适配浏览器环境（替代微信小程序API）
 */

const app = {
  // 词库
  words: window.wordsData || [],
  
  // 当前状态
  currentIndex: 0,
  todayWords: [],
  wordStatus: {},
  studyProgress: {},
  streak: 0,
  stats: { correct: 0, wrong: 0 },
  spellWords: [],
  currentSpellIndex: 0,
  spellHintLevel: 0,

  // 初始化
  init() {
    this.loadData();
    this.updateHomePage();
  },

  // Fisher-Yates 洗牌算法
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // 本地存储（替代 wx.getStorageSync / wx.setStorageSync）
  storage: {
    get(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : undefined;
      } catch (e) {
        return undefined;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  // 加载数据
  loadData() {
    this.wordStatus = this.storage.get('wordStatus') || {};
    this.studyProgress = this.storage.get('studyProgress') || {};
    this.streak = this.studyProgress.streakDays || 0;
  },

  // 页面切换
  goPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    
    if (pageId === 'review') this.renderReviewList();
    if (pageId === 'spell') this.startSpell();
    if (pageId === 'stats') this.renderStats();
  },

  goHome() {
    this.goPage('home');
    this.updateHomePage();
  },

  // 更新首页数据
  updateHomePage() {
    const learnedCount = Object.keys(this.wordStatus).length;
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = this.studyProgress[today] || { learned: 0, total: 30 };
    
    // 计算今日复习词
    const reviewWords = this.getTodayReviewWords();
    
    // 计算今日新词
    const newCount = Math.min(30, this.words.length - learnedCount);
    
    document.getElementById('learned-words').textContent = learnedCount;
    document.getElementById('streak-days').textContent = this.streak;
    document.getElementById('today-learned').textContent = todayProgress.learned;
    document.getElementById('today-total').textContent = todayProgress.total;
    document.getElementById('new-count').textContent = newCount;
    document.getElementById('review-count').textContent = reviewWords.length;
    
    const progress = todayProgress.total > 0 
      ? (todayProgress.learned / todayProgress.total * 100) 
      : 0;
    document.getElementById('today-progress').style.width = progress + '%';
  },

  // 艾宾浩斯复习间隔（1, 2, 4, 7, 15, 30天）
  reviewIntervals: [1, 2, 4, 7, 15, 30],

  // 获取今日复习词
  getTodayReviewWords() {
    const today = new Date();
    const reviewList = [];
    
    for (const [wordId, status] of Object.entries(this.wordStatus)) {
      if (!status.nextReview) continue;
      const nextReview = new Date(status.nextReview);
      if (nextReview <= today) {
        reviewList.push(parseInt(wordId));
      }
    }
    
    return reviewList;
  },

  // 开始学习
  startStudy() {
    const learnedIds = Object.keys(this.wordStatus).map(Number);
    const reviewIds = this.getTodayReviewWords();
    
    // 需要的新词数量
    const maxNew = Math.max(0, 30 - reviewIds.length);
    let newIds = [];

    // 找出所有未学过的单词（随机打乱）
    const allIds = this.words.map(w => w.id);
    const unlearnedIds = allIds.filter(id => !this.wordStatus[id]);
    const shuffledUnlearned = this.shuffleArray(unlearnedIds);
    
    if (shuffledUnlearned.length >= maxNew) {
      // 还有未学的单词，随机取
      newIds = shuffledUnlearned.slice(0, maxNew);
    } else {
      // 未学的全部取完
      newIds = [...shuffledUnlearned];
      
      // 4500个全学完了，从已学单词中补充
      if (newIds.length < maxNew && learnedIds.length > 0) {
        const remaining = maxNew - newIds.length;
        // 优先选熟悉度低（<50）的单词
        const lowFamiliar = learnedIds.filter(id => {
          const s = this.wordStatus[id] || {};
          return (s.familiarity || 0) < 50;
        });
        const shuffledLow = this.shuffleArray(lowFamiliar);
        const extraFromLow = shuffledLow.slice(0, remaining);
        newIds = [...newIds, ...extraFromLow];
        
        // 还不够的话，从全部已学中随机补充
        if (newIds.length < maxNew) {
          const remaining2 = maxNew - newIds.length;
          const usedSet = new Set(newIds);
          const others = learnedIds.filter(id => !usedSet.has(id));
          const shuffledOthers = this.shuffleArray(others);
          newIds = [...newIds, ...shuffledOthers.slice(0, remaining2)];
        }
      }
    }
    
    // 合并：先复习，再新词，然后随机打乱
    this.todayWords = this.shuffleArray([...reviewIds, ...newIds]);
    this.currentIndex = 0;
    this.stats = { correct: 0, vague: 0, wrong: 0 };
    
    if (this.todayWords.length === 0) {
      this.showToast('今日任务已完成！');
      return;
    }
    
    document.getElementById('study-total').textContent = this.todayWords.length;
    this.goPage('study');
    this.showCurrentWord();
  },

  // 显示当前单词
  showCurrentWord() {
    if (this.currentIndex >= this.todayWords.length) {
      this.completeStudy();
      return;
    }
    
    const wordId = this.todayWords[this.currentIndex];
    const word = this.words.find(w => w.id === wordId);
    if (!word) {
      this.currentIndex++;
      this.showCurrentWord();
      return;
    }
    
    document.getElementById('study-current').textContent = this.currentIndex + 1;
    document.getElementById('word-text').textContent = word.word;
    document.getElementById('word-phonetic').textContent = word.phonetic;
    document.getElementById('word-meaning').textContent = word.meaning;
    document.getElementById('memory-association').textContent = word.memory.association;
    document.getElementById('memory-root').textContent = word.memory.root;
    document.getElementById('memory-homophonic').textContent = word.memory.homophonic;
    document.getElementById('example-en').textContent = word.example;
    document.getElementById('example-cn').textContent = word.exampleCn;
    
    // 重置显示
    document.getElementById('word-meaning').classList.add('hidden');
    document.getElementById('memory-section').classList.add('hidden');
    document.getElementById('show-meaning-btn').classList.remove('hidden');
    document.getElementById('study-actions').classList.add('hidden');
    
    // 连击显示
    const streakDisplay = document.getElementById('streak-display');
    if (this.stats.correct > 0 && this.stats.correct % 5 === 0) {
      streakDisplay.textContent = '🔥 连击 x' + this.stats.correct;
    } else {
      streakDisplay.textContent = '';
    }
  },

  // 显示/隐藏释义
  toggleMeaning() {
    document.getElementById('word-meaning').classList.remove('hidden');
    document.getElementById('memory-section').classList.remove('hidden');
    document.getElementById('show-meaning-btn').classList.add('hidden');
    document.getElementById('study-actions').classList.remove('hidden');
  },

  // 播放发音（使用有道TTS）
  playAudio() {
    const wordId = this.todayWords[this.currentIndex];
    const word = this.words.find(w => w.id === wordId);
    if (!word) return;
    
    const audio = new Audio(`https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word.word)}`);
    audio.play().catch(() => {
      this.showToast('播放失败，请检查网络');
    });
  },

  // 标记答案（区分：认识 / 模糊 / 不认识）
  markAnswer(result) {
    const wordId = this.todayWords[this.currentIndex];
    const oldStatus = this.wordStatus[wordId] || {};
    const reviewCount = oldStatus.reviewCount || 0;
    const today = new Date().toISOString().split('T')[0];

    if (result === true) {
      // 认识：按艾宾浩斯递增复习间隔
      const interval = this.reviewIntervals[Math.min(reviewCount, this.reviewIntervals.length - 1)];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);
      this.wordStatus[wordId] = {
        ...oldStatus,
        reviewCount: reviewCount + 1,
        nextReview: nextDate.toISOString().split('T')[0],
        lastStudy: today,
        familiarity: Math.min(100, (oldStatus.familiarity || 0) + 10),
        vague: false,
        wrong: false
      };
      this.stats.correct = (this.stats.correct || 0) + 1;
    } else if (result === 'vague') {
      // 模糊：明天复习，复习次数不变
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      this.wordStatus[wordId] = {
        ...oldStatus,
        reviewCount: reviewCount,
        nextReview: nextDate.toISOString().split('T')[0],
        lastStudy: today,
        familiarity: Math.max(0, (oldStatus.familiarity || 0) - 5),
        vague: true,
        wrong: false
      };
      this.stats.vague = (this.stats.vague || 0) + 1;
    } else {
      // 不认识：明天复习，复习次数不变
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      this.wordStatus[wordId] = {
        ...oldStatus,
        reviewCount: reviewCount,
        nextReview: nextDate.toISOString().split('T')[0],
        lastStudy: today,
        familiarity: Math.max(0, (oldStatus.familiarity || 0) - 10),
        vague: false,
        wrong: true
      };
      this.stats.wrong = (this.stats.wrong || 0) + 1;
    }

    this.storage.set('wordStatus', this.wordStatus);
    this.storage.set('studyStats', this.stats);

    // 下一个
    this.currentIndex++;
    this.showCurrentWord();
  },

  // 完成学习
  completeStudy() {
    const today = new Date().toISOString().split('T')[0];
    
    // 更新进度
    if (!this.studyProgress[today]) {
      this.studyProgress[today] = { learned: 0, total: 30 };
    }
    this.studyProgress[today].learned += this.stats.correct;
    
    // 更新连续天数
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (this.studyProgress.lastStudy === yesterdayStr) {
      this.studyProgress.streakDays = (this.studyProgress.streakDays || 0) + 1;
    } else if (this.studyProgress.lastStudy !== today) {
      this.studyProgress.streakDays = 1;
    }
    this.studyProgress.lastStudy = today;
    
    this.storage.set('studyProgress', this.studyProgress);
    
    // 显示完成弹窗
    const total = this.todayWords.length;
    const correct = this.stats.correct;
    const stars = correct >= total * 0.8 ? '⭐⭐⭐' : correct >= total * 0.5 ? '⭐⭐' : '⭐';
    
    document.getElementById('complete-text').textContent = 
      `今日学习了 ${total} 个词，掌握 ${correct} 个`;
    document.getElementById('complete-stars').textContent = stars;
    document.getElementById('complete-modal').classList.remove('hidden');
  },

  closeComplete() {
    document.getElementById('complete-modal').classList.add('hidden');
    this.goHome();
  },

  // 复习列表
  renderReviewList() {
    const reviewIds = this.getTodayReviewWords();
    const listEl = document.getElementById('review-list');
    
    if (reviewIds.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">今日没有复习任务</div>';
      return;
    }
    
    listEl.innerHTML = reviewIds.map(id => {
      const word = this.words.find(w => w.id === id);
      if (!word) return '';
      const status = this.wordStatus[id] || {};
      const reviewNum = status.reviewCount || 0;
      return `
        <div class="review-item" onclick="app.playWordAudio(${id})">
          <div>
            <div style="font-weight:bold;font-size:16px;">${word.word}</div>
            <div style="color:#999;font-size:13px;">${word.meaning}</div>
          </div>
          <div style="color:#667eea;font-size:13px;">第${reviewNum + 1}轮复习</div>
        </div>
      `;
    }).join('');
  },

  playWordAudio(wordId) {
    const word = this.words.find(w => w.id === wordId);
    if (!word) return;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word.word)}`);
    audio.play().catch(() => {});
  },

  // 拼写练习：专练“不会”的单词库
  startSpell() {
    // 找出所有标记为 wrong（不认识）或 vague（模糊）的单词
    const weakIds = Object.keys(this.wordStatus).map(Number).filter(id => {
      const s = this.wordStatus[id] || {};
      return s.wrong === true || s.vague === true;
    });

    if (weakIds.length < 5) {
      this.showToast('还没有足够的“不会”单词，先去学习吧！');
      this.goHome();
      return;
    }

    // 只从不会/模糊的单词中随机抽10个
    this.spellWords = this.shuffleArray(weakIds)
      .slice(0, 10)
      .map(id => this.words.find(w => w.id === id))
      .filter(Boolean);

    this.currentSpellIndex = 0;
    this.showSpellWord();
  },

  showSpellWord() {
    if (this.currentSpellIndex >= this.spellWords.length) {
      this.showSpellComplete();
      return;
    }

    const word = this.spellWords[this.currentSpellIndex];
    document.getElementById('spell-meaning').textContent = word.meaning;
    document.getElementById('spell-phonetic').textContent = word.phonetic;
    document.getElementById('spell-hint').textContent = '';
    document.getElementById('spell-result').classList.add('hidden');

    // 生成字母输入框
    const inputsContainer = document.getElementById('spell-inputs');
    inputsContainer.innerHTML = '';
    for (let i = 0; i < word.word.length; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'spell-letter-input';
      input.dataset.index = i;
      input.addEventListener('input', (e) => this.onSpellInput(e, i));
      input.addEventListener('keydown', (e) => this.onSpellKeydown(e, i));
      inputsContainer.appendChild(input);
    }

    setTimeout(() => {
      const firstInput = inputsContainer.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  onSpellInput(e, index) {
    const word = this.spellWords[this.currentSpellIndex];
    const inputs = document.querySelectorAll('.spell-letter-input');
    const val = e.target.value.toLowerCase();

    if (val && index < word.word.length - 1) {
      inputs[index + 1].focus();
    }

    if (index === word.word.length - 1 && val) {
      const allFilled = Array.from(inputs).every(inp => inp.value);
      if (allFilled) {
        setTimeout(() => this.checkSpell(), 200);
      }
    }
  },

  onSpellKeydown(e, index) {
    const inputs = document.querySelectorAll('.spell-letter-input');
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputs[index - 1].focus();
    }
  },

  checkSpell() {
    const word = this.spellWords[this.currentSpellIndex];
    const inputs = document.querySelectorAll('.spell-letter-input');
    let userWord = '';
    let correctCount = 0;

    inputs.forEach((input, i) => {
      const val = input.value.toLowerCase();
      userWord += val;
      const isCorrect = val === word.word[i].toLowerCase();
      input.classList.add(isCorrect ? 'correct' : 'wrong');
      input.disabled = true;
      if (isCorrect) correctCount++;
    });

    const resultEl = document.getElementById('spell-result');
    resultEl.classList.remove('hidden');

    if (userWord === word.word.toLowerCase()) {
      resultEl.innerHTML = `
        <div style="color:#4caf50;font-weight:bold;">✅ 正确！</div>
        <div style="margin-top:8px;font-size:14px;">${word.word} ${word.phonetic}</div>
        <div style="margin-top:4px;color:#666;">${word.meaning}</div>
      `;
      this.showToast('✅ 正确！');
      setTimeout(() => {
        this.currentSpellIndex++;
        this.showSpellWord();
      }, 1500);
    } else {
      resultEl.innerHTML = `
        <div style="color:#f44336;font-weight:bold;">❌ 有错误</div>
        <div style="margin-top:8px;font-size:14px;">正确：${word.word}</div>
        <div style="margin-top:4px;color:#666;">${word.meaning}</div>
      `;
      this.showToast('❌ 拼写错误');
      // 标记为不认识
      this.wordStatus[word.id] = {
        ...this.wordStatus[word.id],
        wrong: true,
        nextReview: new Date().toISOString().split('T')[0]
      };
      this.storage.set('wordStatus', this.wordStatus);
      setTimeout(() => {
        this.currentSpellIndex++;
        this.showSpellWord();
      }, 2000);
    }
  },

  showSpellAnswer() {
    const word = this.spellWords[this.currentSpellIndex];
    const inputs = document.querySelectorAll('.spell-letter-input');

    inputs.forEach((input, i) => {
      input.value = word.word[i];
      input.classList.add('correct');
      input.disabled = true;
    });

    const resultEl = document.getElementById('spell-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div style="color:#faad14;font-weight:bold;">💡 答案已显示</div>
      <div style="margin-top:8px;font-size:14px;">${word.word} ${word.phonetic}</div>
      <div style="margin-top:4px;color:#666;">${word.meaning}</div>
    `;
    setTimeout(() => {
      this.currentSpellIndex++;
      this.showSpellWord();
    }, 2000);
  },

  skipSpell() {
    this.currentSpellIndex++;
    this.showSpellWord();
  },

  showSpellComplete() {
    const total = this.spellWords.length;
    const resultEl = document.getElementById('spell-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div style="font-weight:bold;font-size:18px;">🎉 拼写练习完成</div>
      <div style="margin-top:12px;">共 ${total} 个单词</div>
      <button class="btn-primary" style="margin-top:16px;" onclick="app.goHome()">返回首页</button>
    `;
    this.showToast('拼写练习完成！');
  },

  // 统计页面
  renderStats() {
    const learnedCount = Object.keys(this.wordStatus).length;
    const totalAttempts = this.stats.correct + this.stats.wrong;
    const accuracy = totalAttempts > 0 ? Math.round(this.stats.correct / totalAttempts * 100) : 0;
    
    // 学习天数
    const studyDays = Object.keys(this.studyProgress).filter(k => k.includes('-')).length;
    
    document.getElementById('stat-total').textContent = learnedCount;
    document.getElementById('stat-streak').textContent = this.streak;
    document.getElementById('stat-days').textContent = studyDays;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
    
    // 日历
    this.renderCalendar();
  },

  renderCalendar() {
    const calendar = document.getElementById('calendar');
    const today = new Date();
    const days = [];
    
    // 显示最近30天
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasStudy = this.studyProgress[dateStr] && this.studyProgress[dateStr].learned > 0;
      days.push({ date: d.getDate(), checked: hasStudy });
    }
    
    calendar.innerHTML = days.map(d => 
      `<div class="calendar-day ${d.checked ? 'checked' : ''}">${d.date}</div>`
    ).join('');
  },

  // Toast提示
  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
  }
};

// 启动
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
