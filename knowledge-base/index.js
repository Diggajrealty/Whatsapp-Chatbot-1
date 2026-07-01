// Knowledge Base Loader - Organized by Bot
const fs = require('fs');
const path = require('path');

/**
 * Load all JSON files from a bot's folder
 * @param {string} botName - Name of the bot folder (sobha, brigade, nambiar, godrej, abhee, dsr)
 * @returns {object} - Combined data from all JSON files in that folder
 */
function loadBotData(botName) {
    const botFolder = path.join(__dirname, botName);

    // Check if folder exists
    if (!fs.existsSync(botFolder)) {
        console.log(`[KB] Warning: Folder '${botName}' does not exist`);
        return null;
    }

    // Get all JSON files in the folder
    const files = fs.readdirSync(botFolder).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.log(`[KB] Warning: No JSON files in '${botName}' folder`);
        return null;
    }

    // Load the main/bangalore file (prefer *-bangalore.json, fallback to first file)
    const bangaloreFile = files.find(f => f.includes('bangalore'));
    const mainFile = bangaloreFile || files[0];

    const data = JSON.parse(fs.readFileSync(path.join(botFolder, mainFile), 'utf-8'));
    console.log(`[KB] ✅ Loaded ${botName}: ${mainFile}`);

    return data;
}

// Load all bot databases from their respective folders
const knowledgeBase = {
    'sobha': loadBotData('sobha'),
    'brigade': loadBotData('brigade'),
    'nambiar': loadBotData('nambiar'),
    'godrej': loadBotData('godrej'),
    'abhee': loadBotData('abhee'),
    'dsr': loadBotData('dsr')
};

// Legacy mappings for backward compatibility
knowledgeBase['sobha-bangalore'] = knowledgeBase['sobha'];
knowledgeBase['brigade-bangalore'] = knowledgeBase['brigade'];
knowledgeBase['nambiar-bangalore'] = knowledgeBase['nambiar'];
knowledgeBase['godrej-bangalore'] = knowledgeBase['godrej'];
knowledgeBase['abhee-bangalore'] = knowledgeBase['abhee'];

/**
 * Find a project by builder and query string
 * @param {string} builder - 'nambiar', 'brigade', 'sobha', 'godrej', 'abhee', or 'dsr'
 * @param {string} query - Project name or partial name
 * @returns {object|null} - Project object or null
 */
function findProject(builder, query) {
    const builderData = knowledgeBase[builder.toLowerCase()];
    if (!builderData || !builderData.projects) return null;

    query = query.toLowerCase();

    // Search through all projects
    for (const project of builderData.projects) {
        // Check project name
        if (project.name && project.name.toLowerCase().includes(query)) {
            return project;
        }
        // Check project ID
        if (project.id && project.id.toLowerCase().includes(query)) {
            return project;
        }
        // Check if query is in the name (partial match)
        if (project.name) {
            const nameWords = project.name.toLowerCase().split(' ');
            const queryWords = query.split(' ');
            const matches = queryWords.filter(word =>
                nameWords.some(nameWord => nameWord.includes(word) || word.includes(nameWord))
            );
            if (matches.length >= Math.min(2, queryWords.length)) {
                return project;
            }
        }
    }

    return null;
}

/**
 * Get project by number (1-indexed)
 * @param {string} builder - 'nambiar', 'brigade', 'sobha', 'godrej', 'abhee', or 'dsr'
 * @param {number} projectNumber - 1-indexed project number
 * @returns {object|null} - Project object or null
 */
function getProjectByNumber(builder, projectNumber) {
    const builderData = knowledgeBase[builder.toLowerCase()];
    if (!builderData || !builderData.projects) return null;

    const index = projectNumber - 1; // Convert to 0-indexed
    if (index < 0 || index >= builderData.projects.length) return null;

    return builderData.projects[index];
}

/**
 * Format project information into a readable message
 * @param {object} project - Project object
 * @returns {string} - Formatted project description
 */
function formatProjectInfo(project) {
    if (!project) return null;

    let message = `${project.name} is located in ${project.location}. `;
    message += `It offers ${project.type}`;

    if (project.configurations && project.configurations.length > 0) {
        message += ` with ${project.configurations.join(', ')} configurations. `;
    } else {
        message += `. `;
    }

    message += `${project.highlights}\n\n`;
    message += `**Key Features:**\n`;

    // Show top 6 amenities
    if (project.amenities) {
        const topAmenities = project.amenities.slice(0, 6);
        topAmenities.forEach(amenity => {
            message += `• ${amenity}\n`;
        });

        if (project.amenities.length > 6) {
            message += `• And ${project.amenities.length - 6} more amenities\n`;
        }
    }

    message += `\n**Price:** ${project.price}\n`;
    message += `**Possession:** ${project.possession}\n`;
    message += `**Nearby:** ${project.nearby}`;

    return message;
}

/**
 * Get concise project info (shorter version)
 * @param {object} project - Project object
 * @returns {string} - Concise project description
 */
function formatProjectConcise(project) {
    if (!project) return null;

    let message = `${project.name} is located in ${project.location}. `;
    message += `It offers ${project.type}`;

    if (project.configurations && project.configurations.length > 0) {
        message += ` with ${project.configurations.join(' & ')} configurations. `;
    }

    message += `${project.highlights} `;
    message += `Prices start from ${project.price}. Possession: ${project.possession}.`;

    return message;
}

/**
 * Get all projects for a builder
 * @param {string} builder - 'nambiar', 'brigade', 'sobha', 'godrej', 'abhee', or 'dsr'
 * @returns {array} - Array of all projects
 */
function getAllProjects(builder) {
    const builderData = knowledgeBase[builder.toLowerCase()];
    return (builderData && builderData.projects) ? builderData.projects : [];
}

/**
 * Get builder description
 * @param {string} builder - 'nambiar', 'brigade', 'sobha', 'godrej', 'abhee', or 'dsr'
 * @returns {string} - Builder description
 */
function getBuilderDescription(builder) {
    const builderData = knowledgeBase[builder.toLowerCase()];
    return builderData ? builderData.description : null;
}

/**
 * Get formatted project list for greeting message
 * @param {string} builder - 'nambiar', 'brigade', 'sobha', 'godrej', 'abhee', or 'dsr'
 * @returns {string} - Formatted list of projects
 */
function getProjectList(builder) {
    const projects = getAllProjects(builder);
    return projects.map((p, idx) => {
        const status = p.status === 'upcoming' ? ' (Upcoming)' : '';
        const location = p.location ? p.location.split(',')[0] : '';
        return `${idx + 1}. ${p.name} - ${p.type} | ${location}${status}`;
    }).join('\n');
}

module.exports = {
    knowledgeBase,
    findProject,
    getProjectByNumber,
    formatProjectInfo,
    formatProjectConcise,
    getAllProjects,
    getBuilderDescription,
    getProjectList
};
