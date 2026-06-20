// JavaScript Controller for 'Arquitectura de la Riqueza' Audiobook Web App

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let currentChapterId = 'introduccion';
    let currentParagraphIndex = 0;
    let isPlaying = false;
    let speechRate = 1.0;
    let paragraphs = [];
    let currentUtterance = null;
    let availableVoices = [];

    // DOM Elements
    const readerContent = document.getElementById('reader-content');
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevCapBtn = document.getElementById('prev-cap-btn');
    const nextCapBtn = document.getElementById('next-cap-btn');
    const speedSelect = document.getElementById('speed-select');
    const voiceSelect = document.getElementById('voice-select');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const chapterItems = document.querySelectorAll('.chapter-item');

    // --- MARKDOWN PARSER ---
    function parseMarkdown(mdText) {
        let html = '';
        const lines = mdText.split('\n');
        let inList = false;
        let inTable = false;
        let tableHeader = true;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // Handle Lists
            if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                const content = line.substring(2);
                html += `<li>${parseInlineMarkdown(content)}</li>`;
                continue;
            } else if (inList && !line.startsWith('* ') && !line.startsWith('- ') && line !== '') {
                html += '</ul>';
                inList = false;
            }

            // Handle Tables
            if (line.startsWith('|')) {
                if (!inTable) {
                    html += '<table>';
                    inTable = true;
                    tableHeader = true;
                }
                
                // Skip separator line like | :--- | :--- |
                if (line.includes('---') || line.includes(':---')) {
                    continue;
                }

                const cells = line.split('|').slice(1, -1).map(c => c.trim());
                html += '<tr>';
                cells.forEach(cell => {
                    const tag = tableHeader ? 'th' : 'td';
                    html += `<${tag}>${parseInlineMarkdown(cell)}</${tag}>`;
                });
                html += '</tr>';
                tableHeader = false;
                continue;
            } else if (inTable && !line.startsWith('|')) {
                html += '</table>';
                inTable = false;
            }

            if (line === '') {
                continue;
            }

            // Headers
            if (line.startsWith('# ')) {
                html += `<h1>${parseInlineMarkdown(line.substring(2))}</h1>`;
            } else if (line.startsWith('## ')) {
                html += `<h2>${parseInlineMarkdown(line.substring(3))}</h2>`;
            } else if (line.startsWith('### ')) {
                html += `<h3>${parseInlineMarkdown(line.substring(4))}</h3>`;
            } 
            // Callouts / Alerts (e.g. > [!IMPORTANT])
            else if (line.startsWith('>')) {
                let cleanLine = line.substring(1).trim();
                let type = 'note';
                if (cleanLine.startsWith('[!IMPORTANT]') || cleanLine.startsWith('[!WARNING]') || cleanLine.startsWith('[!TIP]')) {
                    type = cleanLine.includes('IMPORTANT') ? 'important' : (cleanLine.includes('WARNING') ? 'warning' : 'tip');
                    cleanLine = cleanLine.substring(cleanLine.indexOf(']') + 1).trim();
                }
                html += `<div class="callout ${type}"><p>${parseInlineMarkdown(cleanLine)}</p></div>`;
            }
            // Horizontal Rule
            else if (line === '---') {
                html += '<hr style="border: 0; border-top: 1px solid var(--border-color); margin: 30px 0;">';
            }
            // Standard Paragraph
            else {
                // Ignore code blocks or render simply
                if (line.startsWith('```')) {
                    let codeContent = '';
                    i++;
                    while (i < lines.length && !lines[i].startsWith('```')) {
                        codeContent += lines[i] + '\n';
                        i++;
                    }
                    if (line.includes('mermaid')) {
                        html += `<div class="mermaid-container"><pre class="mermaid-svg"><code>${codeContent}</code></pre></div>`;
                    } else {
                        html += `<pre><code>${codeContent}</code></pre>`;
                    }
                } else {
                    html += `<p class="sync-paragraph">${parseInlineMarkdown(line)}</p>`;
                }
            }
        }

        if (inList) html += '</ul>';
        if (inTable) html += '</table>';

        return html;
    }

    function parseInlineMarkdown(text) {
        // Strong bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Math inline LaTeX (e.g. $r > i$)
        text = text.replace(/\$(.*?)\$/g, '<code class="latex">$1</code>');
        // File links or links [Text](URL)
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<span class="link-styled">$1</span>');
        return text;
    }

    // --- CHAPTER LOADING ---
    function loadChapter(chapterId) {
        currentChapterId = chapterId;
        currentParagraphIndex = 0;
        
        // Stop any running speech
        stopSpeech();

        // Update active UI sidebar item
        chapterItems.forEach(item => {
            if (item.dataset.id === chapterId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Load chapter text from chapters_data.js (CHAPTERS_DATA object)
        const chapter = CHAPTERS_DATA[chapterId];
        if (chapter) {
            readerContent.innerHTML = parseMarkdown(chapter.content);
            
            // Collect all paragraphs and headings that we want to read
            paragraphs = Array.from(readerContent.querySelectorAll('.sync-paragraph, h1, h2, h3, li'));
            
            // Add custom paragraph indices for narration mapping
            paragraphs.forEach((p, idx) => {
                p.dataset.index = idx;
                
                // Add click listener so clicking on a paragraph jumps the audio there!
                p.addEventListener('click', () => {
                    jumpToParagraph(idx);
                });
            });

            updateProgressUI();
            
            // Auto scroll reader to top
            document.querySelector('.reader-container').scrollTop = 0;
        }
    }

    // --- AUDIO NARRATION ENGINE (SPEECH SYNTHESIS) ---
    
    // Load voices
    function initVoices() {
        if (typeof speechSynthesis === 'undefined') return;
        
        availableVoices = window.speechSynthesis.getVoices();
        
        // Populate Voice Select
        voiceSelect.innerHTML = '';
        
        // Filter Spanish voices
        const spanishVoices = availableVoices.filter(v => v.lang.startsWith('es'));
        
        if (spanishVoices.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "Álvaro (España) - Defecto";
            opt.value = "default";
            voiceSelect.appendChild(opt);
            return;
        }

        // Prioritize: (1) Spanish Spain voices containing Alvaro or male names, (2) any es-ES voice, (3) other es voices
        spanishVoices.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aES = a.lang === 'es-ES';
            const bES = b.lang === 'es-ES';
            
            // Check for Álvaro specifically
            const aAlvaro = aName.includes('alvaro');
            const bAlvaro = bName.includes('alvaro');
            if (aAlvaro && !bAlvaro) return -1;
            if (!aAlvaro && bAlvaro) return 1;

            // Check for Spanish from Spain male voices or general
            if (aES && !bES) return -1;
            if (!aES && bES) return 1;
            return 0;
        });

        spanishVoices.forEach(voice => {
            const option = document.createElement('option');
            // Clean up name for display
            let displayName = voice.name
                .replace("Microsoft", "")
                .replace("Google", "")
                .replace("Desktop", "")
                .trim();
            
            // Label it nicely as Álvaro if it's the top Spanish voice to give the narrator feel
            if (displayName.toLowerCase().includes('alvaro') || voice === spanishVoices[0]) {
                displayName = `Álvaro (España) 🎙️`;
            }

            option.textContent = `${displayName} (${voice.lang})`;
            option.value = voice.name;
            voiceSelect.appendChild(option);
        });
    }

    // Speech synthesis voices loaded async
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = initVoices;
    }
    initVoices();

    function speakParagraph(index) {
        if (index < 0 || index >= paragraphs.length) {
            isPlaying = false;
            updatePlayButton();
            return;
        }

        currentParagraphIndex = index;
        updateProgressUI();

        // Highlight active paragraph
        paragraphs.forEach(p => p.classList.remove('speaking-active'));
        const activeParagraph = paragraphs[index];
        activeParagraph.classList.add('speaking-active');

        // Scroll active paragraph smoothly into view
        activeParagraph.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Cancel previous speech to start fresh
        window.speechSynthesis.cancel();

        // Create new utterance
        const textToSpeak = activeParagraph.textContent.trim();
        if (!textToSpeak) {
            // If empty, skip to next
            speakParagraph(index + 1);
            return;
        }

        currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // Select voice
        const selectedVoiceName = voiceSelect.value;
        const selectedVoice = availableVoices.find(v => v.name === selectedVoiceName);
        if (selectedVoice) {
            currentUtterance.voice = selectedVoice;
        } else {
            // Fallback to first spanish voice
            const spanish = availableVoices.filter(v => v.lang.startsWith('es'));
            if (spanish.length > 0) currentUtterance.voice = spanish[0];
        }

        currentUtterance.rate = speechRate;

        // Callback when paragraph finishes
        currentUtterance.onend = () => {
            if (isPlaying) {
                speakParagraph(currentParagraphIndex + 1);
            }
        };

        currentUtterance.onerror = (e) => {
            console.error("SpeechSynthesis error:", e);
            if (isPlaying) {
                speakParagraph(currentParagraphIndex + 1);
            }
        };

        window.speechSynthesis.speak(currentUtterance);
    }

    function togglePlay() {
        if (paragraphs.length === 0) return;

        if (isPlaying) {
            pauseSpeech();
        } else {
            startSpeech();
        }
    }

    function startSpeech() {
        isPlaying = true;
        updatePlayButton();
        speakParagraph(currentParagraphIndex);
    }

    function pauseSpeech() {
        isPlaying = false;
        updatePlayButton();
        window.speechSynthesis.cancel();
    }

    function stopSpeech() {
        isPlaying = false;
        updatePlayButton();
        window.speechSynthesis.cancel();
        paragraphs.forEach(p => p.classList.remove('speaking-active'));
    }

    function jumpToParagraph(index) {
        currentParagraphIndex = index;
        if (isPlaying) {
            speakParagraph(index);
        } else {
            // Just highlight and scroll, ready to play
            paragraphs.forEach(p => p.classList.remove('speaking-active'));
            paragraphs[index].classList.add('speaking-active');
            paragraphs[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            updateProgressUI();
        }
    }

    function skipForward() {
        if (currentParagraphIndex < paragraphs.length - 1) {
            jumpToParagraph(currentParagraphIndex + 1);
        }
    }

    function skipBackward() {
        if (currentParagraphIndex > 0) {
            jumpToParagraph(currentParagraphIndex - 1);
        }
    }

    // --- CHAPTER TRANSITIONS ---
    function nextChapter() {
        const currentIndex = Array.from(chapterItems).findIndex(item => item.dataset.id === currentChapterId);
        if (currentIndex < chapterItems.length - 1) {
            const nextId = chapterItems[currentIndex + 1].dataset.id;
            loadChapter(nextId);
            if (isPlaying) startSpeech();
        }
    }

    document.getElementById('next-cap-btn').addEventListener('click', nextChapter);

    function prevChapter() {
        const currentIndex = Array.from(chapterItems).findIndex(item => item.dataset.id === currentChapterId);
        if (currentIndex > 0) {
            const prevId = chapterItems[currentIndex - 1].dataset.id;
            loadChapter(prevId);
            if (isPlaying) startSpeech();
        }
    }

    document.getElementById('prev-cap-btn').addEventListener('click', prevChapter);

    // --- UI UPDATES ---
    function updatePlayButton() {
        if (isPlaying) {
            playBtn.innerHTML = '⏸️'; // Pause icon
            playBtn.title = "Pausar narración";
        } else {
            playBtn.innerHTML = '▶️'; // Play icon
            playBtn.title = "Iniciar narración";
        }
    }

    function updateProgressUI() {
        if (paragraphs.length === 0) return;
        
        const percent = ((currentParagraphIndex + 1) / paragraphs.length) * 100;
        progressFill.style.width = `${percent}%`;

        currentTimeEl.textContent = `Párr. ${currentParagraphIndex + 1}`;
        totalTimeEl.textContent = `Total: ${paragraphs.length}`;
    }

    // --- EVENT LISTENERS ---
    playBtn.addEventListener('click', togglePlay);
    nextBtn.addEventListener('click', skipForward);
    prevBtn.addEventListener('click', skipBackward);

    speedSelect.addEventListener('change', (e) => {
        speechRate = parseFloat(e.target.value);
        if (isPlaying) {
            // Restart current paragraph with new speed
            speakParagraph(currentParagraphIndex);
        }
    });

    voiceSelect.addEventListener('change', () => {
        if (isPlaying) {
            speakParagraph(currentParagraphIndex);
        }
    });

    // Chapter list click events
    chapterItems.forEach(item => {
        item.addEventListener('click', () => {
            loadChapter(item.dataset.id);
        });
    });

    // Seek on progress bar click
    progressBar.addEventListener('click', (e) => {
        if (paragraphs.length === 0) return;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        const targetIndex = Math.min(
            Math.floor(percent * paragraphs.length),
            paragraphs.length - 1
        );
        jumpToParagraph(targetIndex);
    });

    // Initialize Page
    loadChapter('introduccion');
});
