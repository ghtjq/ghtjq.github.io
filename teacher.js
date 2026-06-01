document.addEventListener('DOMContentLoaded', () => {
    const user = Store.get('currentUser');
    if (!user || user.role !== 'teacher') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('teacher-name').textContent = user.name;
    document.getElementById('logout-btn').addEventListener('click', () => {
        Store.set('currentUser', null);
        window.location.href = 'index.html';
    });

    const sessionSetup = document.getElementById('session-setup');
    const activeSessionInfo = document.getElementById('active-session-info');
    const displayTopic = document.getElementById('display-topic');
    const displayTemplate = document.getElementById('display-template');
    const topicInput = document.getElementById('session-topic');
    const templateInput = document.getElementById('session-template');
    
    const keywordBoard = document.getElementById('keyword-board');
    const keywordCount = document.getElementById('keyword-count');
    const sentenceReviewList = document.getElementById('sentence-review-list');
    const leaderboard = document.getElementById('leaderboard');

    updateUI();

    document.getElementById('start-session-btn').addEventListener('click', () => {
        const topic = topicInput.value.trim();
        const template = templateInput.value.trim();
        if (!topic) return alert('주제를 입력해주세요!');

        Store.set('session', { active: true, topic, template });
        Store.set('keywords', []);
        Store.set('sentences', []);
        topicInput.value = '';
        templateInput.value = '';
        updateUI();
    });

    document.getElementById('end-session-btn').addEventListener('click', () => {
        if(confirm('정말 이 수업을 종료하시겠습니까?')) {
            Store.set('session', { active: false, topic: '', template: '' });
            Store.set('keywords', []);
            Store.set('sentences', []);
            Store.set('board_data', null);
            
            Store.update('users', (users) => {
                const u = users || {};
                for (let name in u) {
                    if (u[name].role === 'student') {
                        u[name].score = 0;
                    }
                }
                return u;
            }, {});
            
            updateUI();
        }
    });

    Store.onUpdate((key) => {
        if (key === 'session' || key === 'keywords' || key === 'sentences' || key === 'users' || key === 'all') {
            updateUI();
        }
    });

    function updateUI() {
        const session = Store.get('session');
        const keywords = Store.get('keywords', []);
        const sentences = Store.get('sentences', []);
        const users = Store.get('users', {});

        if (session && session.active) {
            sessionSetup.classList.add('hidden');
            activeSessionInfo.classList.remove('hidden');
            displayTopic.textContent = session.topic;
            displayTemplate.textContent = session.template ? `템플릿: ${session.template}` : '';
            if (typeof resizeCanvas === 'function') setTimeout(resizeCanvas, 50);
        } else {
            sessionSetup.classList.remove('hidden');
            activeSessionInfo.classList.add('hidden');
        }

        keywordCount.textContent = `${keywords.length} 단어`;
        if (keywords.length === 0) {
            keywordBoard.innerHTML = '<div class="empty-state">아직 제출된 키워드가 없습니다...</div>';
        } else {
            keywordBoard.innerHTML = '';
            keywords.forEach(kw => {
                const el = document.createElement('div');
                el.className = `keyword-block teacher-view`;
                el.innerHTML = `
                    ${kw.text}
                    <span class="author-tag">작성자: ${kw.author}</span>
                    <button class="delete-btn" onclick="deleteKeyword('${kw.id}')">×</button>
                `;
                keywordBoard.appendChild(el);
            });
        }

        const pendingSentences = sentences.filter(s => s.status === 'pending');
        if (pendingSentences.length === 0) {
            sentenceReviewList.innerHTML = '<div class="empty-state">대기 중인 문장이 없습니다...</div>';
        } else {
            sentenceReviewList.innerHTML = '';
            pendingSentences.forEach(s => {
                const el = document.createElement('div');
                el.className = 'sentence-item';
                el.innerHTML = `
                    <div>
                        <div class="sentence-text">${s.text}</div>
                        <div class="sentence-meta">작성자: ${s.author}</div>
                    </div>
                    <div class="flex-row">
                        <button class="btn btn-small btn-success" onclick="approveSentence('${s.id}')">승인</button>
                        <button class="btn btn-small btn-accent" onclick="rejectSentence('${s.id}')">거절</button>
                    </div>
                `;
                sentenceReviewList.appendChild(el);
            });
        }

        const studentUsers = Object.entries(users)
            .filter(([_, data]) => data.role === 'student')
            .sort((a, b) => b[1].score - a[1].score);

        if (studentUsers.length === 0) {
            leaderboard.innerHTML = '<div class="empty-state">아직 참여한 학생이 없습니다.</div>';
        } else {
            leaderboard.innerHTML = '';
            studentUsers.forEach(([name, data], index) => {
                const el = document.createElement('div');
                el.className = 'sentence-item';
                el.innerHTML = `
                    <div class="sentence-text">${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'} ${name}</div>
                    <div class="flex-row" style="align-items: center;">
                        <span class="score-badge">${data.score} 점</span>
                        <button class="btn btn-small btn-accent" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="removeStudent('${name}')">삭제</button>
                    </div>
                `;
                leaderboard.appendChild(el);
            });
        }
    }
    
    window.deleteKeyword = (id) => {
        Store.update('keywords', (kws) => kws.filter(k => k.id !== id), []);
    };

    window.approveSentence = (id) => {
        Store.update('sentences', (sents) => {
            const s = sents.find(s => s.id === id);
            if (s) {
                s.status = 'approved';
                Store.update('users', (users) => {
                    if (users[s.author]) {
                        users[s.author].score += 10;
                    }
                    if (s.usedKeywords) {
                        s.usedKeywords.forEach(kw => {
                            if (users[kw.author] && kw.author !== s.author) {
                                users[kw.author].score += 5;
                            }
                        });
                    }
                    return users;
                }, {});
            }
            return sents.filter(s => s.id !== id);
        }, []);
    };

    window.rejectSentence = (id) => {
        Store.update('sentences', (sents) => sents.filter(s => s.id !== id), []);
    };

    window.removeStudent = (name) => {
        if (confirm(`정말 '${name}' 학생을 삭제하시겠습니까?`)) {
            Store.update('users', (users) => {
                const u = { ...users };
                delete u[name];
                return u;
            }, {});
        }
    };

    // Presentation Logic
    const canvas = document.getElementById('teacher-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const penColor = document.getElementById('pen-color');
    const clearBoardBtn = document.getElementById('clear-board-btn');
    const imageUpload = document.getElementById('image-upload');

    let isDrawing = false;
    
    if (canvas) {
        window.resizeCanvas = function() {
            if (activeSessionInfo.classList.contains('hidden')) return;
            canvas.width = 1200;
            canvas.height = 900;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 6;
            
            const boardData = Store.get('board_data');
            if (boardData) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                img.src = boardData;
            } else {
                ctx.fillStyle = '#f1f5f9';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };
        
        window.addEventListener('resize', window.resizeCanvas);

        function startDrawing(e) {
            isDrawing = true;
            draw(e);
        }

        function stopDrawing() {
            if (!isDrawing) return;
            isDrawing = false;
            ctx.beginPath();
            syncBoard();
        }

        function draw(e) {
            if (!isDrawing) return;

            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            ctx.strokeStyle = penColor.value;
            
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        function syncBoard() {
            const dataURL = canvas.toDataURL('image/jpeg', 0.6);
            Store.set('board_data', dataURL);
        }

        clearBoardBtn.addEventListener('click', () => {
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            syncBoard();
        });

        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                    const drawW = img.width * scale;
                    const drawH = img.height * scale;
                    const x = (canvas.width / 2) - (drawW / 2);
                    const y = (canvas.height / 2) - (drawH / 2);
                    
                    ctx.fillStyle = '#f1f5f9';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, x, y, drawW, drawH);
                    syncBoard();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
});
