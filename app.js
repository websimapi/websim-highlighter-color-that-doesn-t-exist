const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

// Initialize WebSocket connection
const room = new WebsimSocket();

// Helper function to generate a random and unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Main App Component
const App = () => {
    const [activeHighlighter, setActiveHighlighter] = useState(null);
    const [highlightedText, setHighlightedText] = useState("");
    const [generatedText, setGeneratedText] = useState("");
    const [textPrompt, setTextPrompt] = useState("");
    const [highlighterPrompt, setHighlighterPrompt] = useState("");
    const [isGeneratingText, setIsGeneratingText] = useState(false);
    const [isGeneratingHighlighter, setIsGeneratingHighlighter] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const textAreaRef = useRef(null);
    const [highlighters, setHighlighters] = useState([]);

    // Fetch highlighters from database
    useEffect(() => {
        // Initial fetch of highlighters
        const fetchedHighlighters = room.collection('highlighter').getList();
        setHighlighters(fetchedHighlighters);

        // Subscribe to highlighter collection changes
        const unsubscribe = room.collection('highlighter').subscribe((updatedHighlighters) => {
            setHighlighters(updatedHighlighters);
        });

        return () => unsubscribe();
    }, []);

    // Generate text with LLM
    const generateText = async () => {
        if (!textPrompt.trim()) return;
        
        setIsGeneratingText(true);
        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a creative writing assistant."
                    },
                    {
                        role: "user",
                        content: textPrompt
                    }
                ]
            });
            
            setGeneratedText(completion.content);
        } catch (error) {
            console.error("Error generating text:", error);
            alert("Failed to generate text. Please try again.");
        } finally {
            setIsGeneratingText(false);
        }
    };

    // Generate highlighter with LLM
    const generateHighlighter = async () => {
        if (!highlighterPrompt.trim()) return;
        
        setIsGeneratingHighlighter(true);
        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Create a unique highlighter style based on the prompt. 
                        Respond with JSON containing CSS properties for the highlighter.
                        Include creative properties like gradients, blends, or animations that could be used to highlight text.
                        The result should be visually interesting and unique.`
                    },
                    {
                        role: "user",
                        content: highlighterPrompt
                    }
                ],
                json: true
            });
            
            // Parse the response
            const highlighterStyle = JSON.parse(completion.content);
            
            // Create a new highlighter object
            const newHighlighter = {
                id: generateId(),
                name: highlighterPrompt,
                style: highlighterStyle,
                created_at: new Date().toISOString()
            };
            
            // Save to database
            await room.collection('highlighter').create(newHighlighter);
            setHighlighterPrompt("");
            
        } catch (error) {
            console.error("Error generating highlighter:", error);
            alert("Failed to generate highlighter. Please try again.");
        } finally {
            setIsGeneratingHighlighter(false);
        }
    };

    // Handle text selection in the canvas
    const handleTextSelection = () => {
        const selection = window.getSelection();
        const selectedText = selection.toString();
        if (selectedText.trim().length > 0) {
            setSelectedText(selectedText);
        }
    };

    // Apply highlighter to selected text
    const applyHighlighter = () => {
        if (!selectedText || !activeHighlighter) return;
        
        // Create a span with the highlighter style around the selected text
        const highlightedSpan = `<span class="highlighted-text" style="${getHighlighterCssString(activeHighlighter.style)}">${selectedText}</span>`;
        
        // Replace the selected text with the highlighted version
        const newText = generatedText.replace(selectedText, highlightedSpan);
        setHighlightedText(newText);
        setGeneratedText(newText);
        setSelectedText("");
    };

    // Convert highlighter style object to CSS string
    const getHighlighterCssString = (style) => {
        let cssString = "";
        for (const [key, value] of Object.entries(style)) {
            // Convert camelCase to kebab-case
            const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            cssString += `${kebabKey}: ${value}; `;
        }
        return cssString;
    };

    // Render highlighter preview
    const renderHighlighterPreview = () => {
        if (!activeHighlighter) return null;
        
        const style = getHighlighterCssString(activeHighlighter.style);
        return (
            <div className="highlighter-preview">
                <div>Selected: <strong>{activeHighlighter.name}</strong></div>
                <p>
                    <span className="highlighted-text" style={activeHighlighter.style}>
                        This is how your highlighter looks
                    </span>
                </p>
            </div>
        );
    };

    return (
        <div className="app-container">
            <header>
                <h1>Highlighter Color That Doesn't Exist</h1>
                <p>Generate unique highlighters and use them on text</p>
            </header>
            
            <div className="main-content">
                <section className="canvas-section">
                    <h2 className="section-title">Canvas</h2>
                    <div 
                        className="canvas-container" 
                        onClick={handleTextSelection}
                        onMouseUp={handleTextSelection}
                    >
                        <div 
                            className="canvas-text" 
                            ref={textAreaRef}
                            dangerouslySetInnerHTML={{ __html: generatedText }}
                        />
                    </div>
                    
                    {selectedText && (
                        <div className="highlight-controls">
                            <button onClick={applyHighlighter} disabled={!activeHighlighter}>
                                Highlight Selected Text
                            </button>
                            <span><strong>Selected:</strong> {selectedText.substring(0, 30)}...</span>
                        </div>
                    )}
                </section>
                
                <section className="controls-section">
                    <div className="generate-section">
                        <h2 className="section-title">Generate Text</h2>
                        <div className="text-controls">
                            <textarea 
                                value={textPrompt}
                                onChange={(e) => setTextPrompt(e.target.value)}
                                placeholder="Enter a prompt for text generation..."
                                rows="3"
                            />
                            <button 
                                onClick={generateText} 
                                disabled={isGeneratingText || !textPrompt.trim()}
                            >
                                {isGeneratingText ? (
                                    <>
                                        <div className="loading-spinner"></div> Generating...
                                    </>
                                ) : "Generate Text"}
                            </button>
                        </div>
                    </div>
                    
                    <div className="generate-section">
                        <h2 className="section-title">Create New Highlighter</h2>
                        <input 
                            type="text" 
                            value={highlighterPrompt}
                            onChange={(e) => setHighlighterPrompt(e.target.value)}
                            placeholder="Describe a highlighter that doesn't exist..."
                        />
                        <button 
                            onClick={generateHighlighter}
                            disabled={isGeneratingHighlighter || !highlighterPrompt.trim()}
                        >
                            {isGeneratingHighlighter ? (
                                <>
                                    <div className="loading-spinner"></div> Creating...
                                </>
                            ) : "Create Highlighter"}
                        </button>
                    </div>
                    
                    <div className="highlighter-selection">
                        <h2 className="section-title">Your Highlighters</h2>
                        {highlighters.length === 0 ? (
                            <p>No highlighters yet. Create one above!</p>
                        ) : (
                            <div className="highlighter-gallery">
                                {highlighters.map(highlighter => (
                                    <div 
                                        key={highlighter.id} 
                                        className={`highlighter-item ${activeHighlighter?.id === highlighter.id ? 'active' : ''}`}
                                        style={highlighter.style}
                                        onClick={() => setActiveHighlighter(highlighter)}
                                        title={highlighter.name}
                                    />
                                ))}
                            </div>
                        )}
                        {renderHighlighterPreview()}
                    </div>
                </section>
            </div>
            
            <section className="gallery-section">
                <h2 className="section-title">Highlighter Gallery</h2>
                <div className="highlighter-gallery">
                    {highlighters.map(highlighter => (
                        <div key={highlighter.id} style={{ margin: '10px', textAlign: 'center' }}>
                            <div 
                                className="highlighter-item" 
                                style={{ ...highlighter.style, width: '80px', height: '80px', margin: '0 auto' }}
                            />
                            <p style={{ marginTop: '5px', fontSize: '12px' }}>{highlighter.name}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

// Render the app
const rootElement = document.getElementById('app');
const root = createRoot(rootElement);
root.render(<App />);

