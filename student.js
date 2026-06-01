document.addEventListener('DOMContentLoaded', () => {
    const user = Store.get('currentUser');
    if (!user || user.role !== 'student') {
        window.location.href = 'index.html';
        return;
    }

    const studentNameEl = document.getElementById('student-name');
    const studentScoreEl = document.getElementById('student-score');
    studentNameEl.textContent = user.name;
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        Store.set('currentUser', null);
        window.location.href = 'index.html';
    });

    const waitingState = document.getElementById('waiting-state');
    const activeSessionContainer = document.getElementById('active-session-container');
    const displayTopic = document.getElementById('display-topic');
    const displayTemplate = document.getElementById('display-template');
    
    const keywordInput = document.getElementById('keyword-input');
    const submitKeywordBtn = document.getElementById('submit-keyword-btn');
    
    const keywordBoard = document.getElementById('keyword-board');
    const builderZone = document.getElementById('sentence-builder-zone');
    const submitSentenceBtn = document.getElementById('submit-sentence-btn');

    let localBuilderKeywords = [];

    updateUI();

    submitKeywordBtn.addEventListener('click', () => {
        const text = keywordInput.value.trim();
        if (!text) return;

        const session = Store.get('session');
        if (!session || !session.active) return;

        let isDuplicate = false;
        Store.update('keywords', (kws) => {
            const list = kws || [];
            if (list.some(k => k.text.toLowerCase() === text.toLowerCase())) {
                isDuplicate = true;
                return list;
            }
            list.push({
                id: Store.generateId(),
                text: text,
                author: user.name,
                status: 'pending'
            });
            return list;
        }, []);
        
        if (isDuplicate) {
            alert('이미 같은 키워드가 등록되어 있습니다! 다른 단어를 생각해보세요.');
        } else {
            keywordInput.value = '';
        }
    });

    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitKeywordBtn.click();
    });

    submitSentenceBtn.addEventListener('click', () => {
        if (localBuilderKeywords.length === 0) {
            alert('먼저 문장에 단어를 추가해주세요!');
            return;
        }

        const session = Store.get('session');
        
        let sentenceText = '';
        if (session && session.template) {
            const parts = session.template.split('___');
            let kwIndex = 0;
            for(let i=0; i<parts.length; i++) {
                sentenceText += parts[i];
                if (i < parts.length - 1) {
                    if (kwIndex < localBuilderKeywords.length) {
                        sentenceText += `[${localBuilderKeywords[kwIndex].text}]`;
                        kwIndex++;
                    } else {
                        sentenceText += `[___]`;
                    }
                }
            }
            while(kwIndex < localBuilderKeywords.length) {
                sentenceText += ` [${localBuilderKeywords[kwIndex].text}]`;
                kwIndex++;
            }
        } else {
            sentenceText = localBuilderKeywords.map(k => k.text).join(' ');
        }

        Store.update('sentences', (sents) => {
            const list = sents || [];
            list.push({
                id: Store.generateId(),
                text: sentenceText,
                author: user.name,
                status: 'pending',
                usedKeywords: localBuilderKeywords
            });
            return list;
        }, []);

        localBuilderKeywords = [];
        renderBoardAndBuilder();
        alert('선생님께 문장을 제출했습니다!');
    });

    Store.onUpdate((key) => {
        if (key === 'session' || key === 'keywords' || key === 'users' || key === 'all') {
            updateUI();
        }
        if (key === 'board_data' || key === 'all') {
            drawBoard();
        }
    });

    const canvas = document.getElementById('student-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let lastBoardData = null;

    if (canvas) {
        window.addEventListener('resize', () => {
            if (activeSessionContainer.classList.contains('hidden')) return;
            canvas.width = 1200;
            canvas.height = 900;
            lastBoardData = null;
            drawBoard();
        });
    }

    function drawBoard() {
        if (!canvas || !ctx) return;
        const boardData = Store.get('board_data');
        if (boardData === lastBoardData && boardData !== null) return;
        lastBoardData = boardData;

        if (boardData) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = boardData;
        } else {
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    function updateUI() {
        const session = Store.get('session');
        const users = Store.get('users', {});

        if (users[user.name]) {
            studentScoreEl.textContent = `${users[user.name].score} 점`;
        }

        if (session && session.active) {
            waitingState.classList.add('hidden');
            activeSessionContainer.classList.remove('hidden');
            
            displayTopic.textContent = session.topic;
            displayTemplate.textContent = session.template ? `템플릿: ${session.template}` : '';
            
            renderBoardAndBuilder();
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        } else {
            waitingState.classList.remove('hidden');
            activeSessionContainer.classList.add('hidden');
            localBuilderKeywords = []; 
        }
    }

    function renderBoardAndBuilder() {
        const allKeywords = Store.get('keywords', []);
        
        keywordBoard.innerHTML = '';
        
        if (allKeywords.length === 0) {
            keywordBoard.innerHTML = '<div class="empty-state">키워드를 기다리는 중...</div>';
        } else {
            allKeywords.forEach(kw => {
                const el = document.createElement('div');
                el.className = 'keyword-block';
                el.draggable = true;
                el.dataset.id = kw.id;
                el.dataset.text = kw.text;
                el.innerHTML = `${kw.text} <span class="author-tag">작성자: ${kw.author}</span>`;
                
                el.addEventListener('dragstart', handleDragStart);
                keywordBoard.appendChild(el);
            });
        }

        builderZone.innerHTML = '';
        if (localBuilderKeywords.length === 0) {
            builderZone.innerHTML = '<div class="empty-state" style="pointer-events: none;">여기에 단어를 놓으세요!</div>';
        } else {
            localBuilderKeywords.forEach((kw, index) => {
                const el = document.createElement('div');
                el.className = 'keyword-block pending';
                el.draggable = true;
                el.dataset.index = index;
                el.innerHTML = `${kw.text} <span class="author-tag">작성자: ${kw.author}</span>`;
                
                el.addEventListener('click', () => {
                    localBuilderKeywords.splice(index, 1);
                    renderBoardAndBuilder();
                });
                
                builderZone.appendChild(el);
            });
        }
    }

    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: e.target.dataset.id,
            text: e.target.dataset.text,
            author: e.target.querySelector('.author-tag').textContent.replace('작성자: ', '')
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }

    builderZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        builderZone.classList.add('drag-over');
    });

    builderZone.addEventListener('dragleave', () => {
        builderZone.classList.remove('drag-over');
    });

    builderZone.addEventListener('drop', (e) => {
        e.preventDefault();
        builderZone.classList.remove('drag-over');
        
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
            const kw = JSON.parse(data);
            localBuilderKeywords.push(kw);
            renderBoardAndBuilder();
        }
    });

    keywordBoard.addEventListener('dragover', (e) => e.preventDefault());
});
