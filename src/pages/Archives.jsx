import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';
import { fetchProjects, fetchProject, deleteProject, exportProject } from '../services/api';
import './Archives.css';

const GENRES = ['ALL', 'SHONEN', 'SEINEN', 'MECHA', 'SHOJO'];
const SORT_OPTIONS = ['NEWEST', 'OLDEST'];

export default function Archives() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeGenre, setActiveGenre] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NEWEST');
    const [selectedProject, setSelectedProject] = useState(null);
    const [readMode, setReadMode] = useState(false);
    const [loadingProject, setLoadingProject] = useState(false);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const genre = activeGenre === 'ALL' ? undefined : activeGenre;
            const sort = sortOrder === 'NEWEST' ? 'desc' : 'asc';
            const data = await fetchProjects({ genre, sort });
            setProjects(data);
        } catch (err) {
            console.error('Failed to load archives:', err);
            setError('Failed to connect to the archives. Make sure the backend is running.');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [activeGenre, sortOrder]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleDelete = async (e, projectId) => {
        e.stopPropagation();
        if (!confirm('PURGE THIS RECORD?')) return;
        try {
            await deleteProject(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleExport = async (e, projectId) => {
        e.stopPropagation();
        try {
            await exportProject(projectId);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    const openReadMode = async (project) => {
        setReadMode(true);
        setLoadingProject(true);
        document.body.style.overflow = 'hidden';

        try {
            // Fetch full project with pages and panels
            const fullProject = await fetchProject(project.id);
            setSelectedProject(fullProject);
        } catch (err) {
            console.error('Failed to load project:', err);
            // Fallback to the list-level data (no panels)
            setSelectedProject(project);
        } finally {
            setLoadingProject(false);
        }
    };

    const closeReadMode = () => {
        setReadMode(false);
        setSelectedProject(null);
        document.body.style.overflow = '';
    };

    return (
        <>
            <div className="halftone-overlay" />
            <VideoBackground />

            <main className="archives-main fade-in-up">
                <header className="archives-header">
                    <div className="archives-header-left">
                        <h1 className="logo text-display animate-glitch" onClick={() => navigate('/')}>RAGNA</h1>
                        <span className="archives-title text-mono">// ARCHIVES</span>
                    </div>
                    <nav className="nav-links text-mono">
                        <a onClick={() => navigate('/')} className="nav-link">HOME</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/forge')} className="nav-link">FORGE</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/manifesto')} className="nav-link">MANIFESTO</a>
                    </nav>
                </header>

                {/* Filter Bar */}
                <div className="archives-filters">
                    <div className="filter-group">
                        <span className="filter-label text-mono">GENRE_FILTER:</span>
                        <div className="filter-options">
                            {GENRES.map(g => (
                                <button
                                    key={g}
                                    className={`filter-btn text-mono ${activeGenre === g ? 'active' : ''}`}
                                    onClick={() => setActiveGenre(g)}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="filter-group">
                        <span className="filter-label text-mono">SORT:</span>
                        <div className="filter-options">
                            {SORT_OPTIONS.map(s => (
                                <button
                                    key={s}
                                    className={`filter-btn text-mono ${sortOrder === s ? 'active' : ''}`}
                                    onClick={() => setSortOrder(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="project-count text-mono">{projects.length} RECORDS</span>
                </div>

                {/* Project Grid */}
                {loading ? (
                    <div className="archives-loading">
                        <div className="loading-spinner" />
                        <p className="text-mono">ACCESSING ARCHIVES...</p>
                    </div>
                ) : error ? (
                    <div className="archives-empty">
                        <h2 className="text-display">FAULT</h2>
                        <p className="text-mono">{error}</p>
                        <button onClick={loadProjects} className="btn-primary text-display">
                            RETRY
                        </button>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="archives-empty">
                        <h2 className="text-display">VOID</h2>
                        <p className="text-mono">No records found. The archives are empty.</p>
                        <button onClick={() => navigate('/forge')} className="btn-primary text-display">
                            INITIALIZE FIRST PROJECT
                        </button>
                    </div>
                ) : (
                    <div className="archives-grid">
                        {projects.map((project, index) => (
                            <div
                                key={project.id}
                                className="archive-card"
                                onClick={() => openReadMode(project)}
                                style={{ animationDelay: `${index * 0.08}s` }}
                            >
                                <div className="card-image-wrap">
                                    {project.coverImageUrl ? (
                                        <img
                                            src={project.coverImageUrl}
                                            alt={project.title}
                                            className="card-cover"
                                        />
                                    ) : (
                                        <div className="card-cover-placeholder">
                                            <span className="text-display">{project.title?.charAt(0) || '?'}</span>
                                        </div>
                                    )}
                                    <div className="card-slash" />
                                </div>

                                <div className="card-info">
                                    <h3 className="card-title text-display">{project.title}</h3>
                                    <div className="card-meta text-mono">
                                        <span className="card-genre">{project.genre}</span>
                                        <span className="card-panels">{project.panelCount || 0} PANELS</span>
                                    </div>
                                    <p className="card-prompt text-mono">{project.originalPrompt?.substring(0, 80)}...</p>
                                </div>

                                <div className="card-actions">
                                    <button className="action-btn text-mono" onClick={(e) => handleExport(e, project.id)}>
                                        [ EXPORT_RAW ]
                                    </button>
                                    <button className="action-btn danger text-mono" onClick={(e) => handleDelete(e, project.id)}>
                                        [ PURGE ]
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Immersive Read Mode Overlay ─────────────────── */}
            {readMode && (
                <div className="read-mode-overlay" onClick={closeReadMode}>
                    <div className="read-mode-content" onClick={e => e.stopPropagation()}>
                        {loadingProject ? (
                            <div className="read-mode-loading">
                                <div className="loading-spinner" />
                                <p className="text-mono">LOADING PROJECT...</p>
                            </div>
                        ) : selectedProject ? (
                            <>
                                <header className="read-mode-header">
                                    <div>
                                        <h2 className="text-display">{selectedProject.title}</h2>
                                        <div className="read-mode-meta text-mono">
                                            <span className="read-genre">{selectedProject.genre}</span>
                                            <span>AI: {selectedProject.aiModelUsed}</span>
                                        </div>
                                    </div>
                                    <button className="close-btn text-mono" onClick={closeReadMode}>[ CLOSE ]</button>
                                </header>

                                <div className="read-mode-prompt text-mono">
                                    "{selectedProject.originalPrompt}"
                                </div>

                                <div className="read-mode-panels">
                                    {selectedProject.pages?.length > 0 ? (
                                        selectedProject.pages.flatMap(page =>
                                            page.panels?.map(panel => (
                                                <div key={panel.id} className={`read-panel read-panel-${panel.type.toLowerCase()}`}>
                                                    {panel.type === 'IMAGE_PANEL' ? (
                                                        <img src={panel.content} alt={`Panel ${panel.orderIndex}`} className="read-panel-image" />
                                                    ) : panel.type === 'NARRATION' ? (
                                                        <div className="read-narration-block">
                                                            <span className="read-type-tag text-mono">NARRATION</span>
                                                            <p className="read-narration text-mono">{panel.content}</p>
                                                        </div>
                                                    ) : panel.type === 'DIALOGUE' ? (
                                                        <div className="read-dialogue">
                                                            <span className="read-type-tag text-mono">DIALOGUE</span>
                                                            <div className="read-dialogue-inner">
                                                                <span className="dialogue-mark">"</span>
                                                                <p className="text-mono">{panel.content}</p>
                                                                <span className="dialogue-mark">"</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="read-sfx-block">
                                                            <p className="read-sfx text-display">{panel.content}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        <p className="text-mono" style={{ opacity: 0.5, textAlign: 'center', padding: '3rem 0' }}>
                                            No panels in this project yet.
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </>
    );
}
