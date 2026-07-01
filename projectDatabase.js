// Complete Project Database - No need for web search!
// All information pre-loaded and ready to use

const projectDatabase = {
    // ═══════════════════════════════════════════════════════════
    // NAMBIAR BUILDERS PROJECTS
    // ═══════════════════════════════════════════════════════════
    nambiar: {
        'district 25': {
            name: 'Nambiar District 25',
            type: 'Premium Independent Villas',
            location: 'Sarjapur Road, near HSR Layout',
            configurations: '3 BHK & 4 BHK Villas',
            size: '3 BHK: 2100 sq.ft | 4 BHK: 2800 sq.ft',
            price: '₹1.8 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Clubhouse with gym and indoor games',
                'Swimming pool',
                'Landscaped gardens',
                'Children\'s play area',
                'Jogging track',
                '24/7 security with CCTV',
                'Ample parking',
                'Power backup'
            ],
            highlights: 'Gated villa community with 25 acres of green spaces',
            nearby: 'HSR Layout (3 km), Electronic City (8 km), Wipro Corporate Office (5 km)'
        },
        'ellegenza': {
            name: 'Nambiar Ellegenza',
            type: '2 & 3 BHK Apartments',
            location: 'Devanahalli, North Bangalore',
            configurations: '2 BHK & 3 BHK',
            size: '2 BHK: 1200 sq.ft | 3 BHK: 1650 sq.ft',
            price: '₹65 Lakhs onwards',
            possession: 'Dec 2025',
            amenities: [
                'Modern clubhouse',
                'Swimming pool',
                'Gym and yoga room',
                'Indoor games room',
                'Children\'s play area',
                'Landscaped gardens',
                '24/7 security',
                'Visitor parking'
            ],
            highlights: 'Affordable luxury near Kempegowda International Airport',
            nearby: 'Airport (12 km), Aerospace Park (5 km), BIAL IT Park (8 km)'
        },
        'bellezea': {
            name: 'Nambiar Bellezea',
            type: 'Luxury 3 & 4 BHK Apartments',
            location: 'Whitefield, East Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1800 sq.ft | 4 BHK: 2400 sq.ft',
            price: '₹1.2 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Premium clubhouse with spa',
                'Infinity swimming pool',
                'State-of-the-art gym',
                'Indoor badminton court',
                'Library and reading room',
                'Rooftop garden',
                '24/7 concierge service',
                'EV charging stations'
            ],
            highlights: 'Ultra-modern architecture with smart home features',
            nearby: 'ITPL (4 km), Whitefield Main Road (2 km), Phoenix Marketcity (3 km)'
        },
        'embassy boulevard': {
            name: 'Nambiar The Embassy Boulevard',
            type: 'Luxury Apartments',
            location: 'Bellary Road, North Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1900 sq.ft | 4 BHK: 2600 sq.ft',
            price: '₹1.4 Cr onwards',
            possession: 'Under Construction - Dec 2026',
            amenities: [
                'World-class clubhouse',
                'Olympic-size swimming pool',
                'Tennis court',
                'Basketball court',
                'Multipurpose hall',
                'Landscaped parks',
                'Amphitheater',
                'Retail shops within complex'
            ],
            highlights: 'Premium high-rise living with stunning city views',
            nearby: 'Manyata Tech Park (5 km), Yelahanka (8 km), Bangalore Airport (25 km)'
        },
        'millennia': {
            name: 'Nambiar Millennia',
            type: 'Premium Residential Plots',
            location: 'Devanahalli, North Bangalore',
            configurations: 'Plots ranging from 1200 to 2400 sq.ft',
            size: '30x40, 40x60, 50x80 plots available',
            price: '₹45 Lakhs onwards',
            possession: 'Ready to Construct',
            amenities: [
                'Gated community',
                'Underground drainage',
                'Street lights',
                'Water supply',
                'Paved roads',
                'Security cabin',
                'Children\'s park',
                'Landscaping'
            ],
            highlights: 'DTCP approved plots near airport, build your dream home',
            nearby: 'Airport (10 km), Financial City (12 km), Aerospace Park (6 km)'
        },
        'palmshire': {
            name: 'Nambiar Palmshire',
            type: 'Independent Villas',
            location: 'Devanahalli, North Bangalore',
            configurations: '3 BHK & 4 BHK Villas',
            size: '3 BHK: 2000 sq.ft | 4 BHK: 2700 sq.ft',
            price: '₹1.5 Cr onwards',
            possession: 'Upcoming - Launch in Q3 2026',
            amenities: [
                'Private gardens for each villa',
                'Clubhouse with pool',
                'Tennis court',
                'Walking trails',
                'Children\'s play area',
                'Solar power backup',
                'Rainwater harvesting',
                'Smart home automation'
            ],
            highlights: 'Eco-friendly villa community with sustainable living features',
            nearby: 'Airport (15 km), Aerospace Park (7 km), International Schools (5 km)'
        }
    },

    // ═══════════════════════════════════════════════════════════
    // BRIGADE GROUP PROJECTS
    // ═══════════════════════════════════════════════════════════
    brigade: {
        'eldorado': {
            name: 'Brigade Eldorado',
            type: '2, 3 & 4 BHK Apartments',
            location: 'Bagalur Road, North Bangalore',
            configurations: '2 BHK, 3 BHK & 4 BHK',
            size: '2 BHK: 1100 sq.ft | 3 BHK: 1600 sq.ft | 4 BHK: 2200 sq.ft',
            price: '₹60 Lakhs onwards',
            possession: 'Ready to Move',
            amenities: [
                '50+ amenities including clubhouse',
                'Swimming pool',
                'Gym and aerobics room',
                'Indoor games',
                'Kids play area',
                'Jogging track',
                'Amphitheater',
                'Landscaped gardens'
            ],
            highlights: 'Affordable premium living with excellent connectivity',
            nearby: 'Yelahanka (10 km), Manyata Tech Park (15 km), Devanahalli Airport (20 km)'
        },
        'utopia': {
            name: 'Brigade Utopia',
            type: '3 & 4 BHK Premium Apartments',
            location: 'Whitefield, East Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1850 sq.ft | 4 BHK: 2500 sq.ft',
            price: '₹1.1 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Sprawling 75,000 sq.ft clubhouse',
                'Olympic-size swimming pool',
                'Squash and badminton courts',
                'Spa and salon',
                'Library',
                'Banquet hall',
                'Mini theater',
                'Convenience store'
            ],
            highlights: 'Luxury integrated enclave with world-class facilities',
            nearby: 'ITPL (3 km), Whitefield Main Road (1 km), Varthur Lake (4 km)'
        },
        'cornerstone utopia': {
            name: 'Brigade Cornerstone Utopia',
            type: '2 & 3 BHK Apartments',
            location: 'Varthur, Whitefield',
            configurations: '2 BHK & 3 BHK',
            size: '2 BHK: 1250 sq.ft | 3 BHK: 1700 sq.ft',
            price: '₹85 Lakhs onwards',
            possession: 'Dec 2025',
            amenities: [
                'Modern clubhouse',
                'Swimming pool',
                'Gym',
                'Yoga deck',
                'Indoor games',
                'Children\'s play area',
                'Skating rink',
                'Party hall'
            ],
            highlights: 'Contemporary design with smart home features',
            nearby: 'Whitefield (5 km), KR Puram (8 km), Marathahalli (10 km)'
        },
        'orchards': {
            name: 'Brigade Orchards',
            type: 'Integrated Township',
            location: 'Devanahalli, North Bangalore',
            configurations: 'Apartments, Villas, and Plots',
            size: 'Apartments: 1-4 BHK | Villas: 3-4 BHK | Plots: 1200-2400 sq.ft',
            price: 'Starting ₹50 Lakhs',
            possession: 'Ready to Move / Under Construction phases',
            amenities: [
                '130+ amenities across 130 acres',
                'International school within campus',
                'Retail boulevard',
                'Healthcare center',
                'Multiple clubhouses',
                'Sports complex',
                'Skating rink',
                'Adventure park'
            ],
            highlights: 'India\'s largest plotted development with all facilities',
            nearby: 'Bangalore Airport (12 km), Financial City (10 km), Aerospace Park (8 km)'
        },
        'valencia': {
            name: 'Brigade Valencia',
            type: '3 & 4 BHK Luxury Apartments',
            location: 'JP Nagar, South Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1900 sq.ft | 4 BHK: 2600 sq.ft',
            price: '₹1.3 Cr onwards',
            possession: 'Under Construction - Mar 2027',
            amenities: [
                'Premium clubhouse',
                'Infinity pool',
                'Rooftop lounge',
                'Home theater',
                'Gym and spa',
                'Indoor sports',
                'Co-working spaces',
                'EV charging points'
            ],
            highlights: 'Luxury high-rise apartments in established South Bangalore',
            nearby: 'JP Nagar Metro (2 km), Bannerghatta Road (3 km), RV College (5 km)'
        },
        'citadel': {
            name: 'Brigade Citadel',
            type: 'Premium Villas',
            location: 'Budigere Cross, East Bangalore',
            configurations: '3 & 4 BHK Villas',
            size: '3 BHK: 2100 sq.ft | 4 BHK: 2900 sq.ft',
            price: '₱1.6 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Gated community',
                'Clubhouse with pool',
                'Gymnasium',
                'Indoor games',
                'Children\'s play area',
                'Landscaped gardens',
                '24/7 security',
                'Power and water backup'
            ],
            highlights: 'Premium villa community with excellent connectivity to IT hubs',
            nearby: 'Whitefield (12 km), KR Puram (8 km), Airport (25 km)'
        },
        'el dorado': {
            name: 'Brigade El Dorado',
            type: 'Luxury Residences',
            location: 'Bannerghatta Road, South Bangalore',
            configurations: '3 & 4 BHK Apartments',
            size: '3 BHK: 2000 sq.ft | 4 BHK: 2700 sq.ft',
            price: '₹1.4 Cr onwards',
            possession: 'Upcoming - Launch in Q4 2026',
            amenities: [
                'Ultra-modern clubhouse',
                'Sky lounge',
                'Infinity pool',
                'Tennis and basketball courts',
                'Spa and wellness center',
                'Multipurpose hall',
                'Co-working spaces',
                'Pet park'
            ],
            highlights: 'Upcoming luxury project in premium South Bangalore location',
            nearby: 'IIM Bangalore (3 km), Meenakshi Mall (5 km), Electronic City (15 km)'
        }
    },

    // ═══════════════════════════════════════════════════════════
    // SOBHA LIMITED PROJECTS
    // ═══════════════════════════════════════════════════════════
    sobha: {
        'ayana': {
            name: 'SOBHA Ayana',
            type: '3 & 4 BHK Premium Apartments',
            location: 'Panathur Road, Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1850 sq.ft | 4 BHK: 2500 sq.ft',
            price: '₹1.2 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'SOBHA signature clubhouse',
                'Swimming pool',
                'Squash and badminton courts',
                'Gymnasium',
                'Yoga and meditation center',
                'Indoor games room',
                'Children\'s play area',
                'Landscaped gardens'
            ],
            highlights: 'Premium SOBHA quality construction with elegant design',
            nearby: 'Sarjapur Road (3 km), Outer Ring Road (5 km), Wipro Campus (7 km)'
        },
        'infinia': {
            name: 'SOBHA Infinia',
            type: 'Ultra-Luxury High-Rise Apartments',
            location: 'Rajajinagar, West Bangalore',
            configurations: '3 & 4 BHK Penthouses',
            size: '3 BHK: 2200 sq.ft | 4 BHK: 3200 sq.ft',
            price: '₹2.5 Cr onwards',
            possession: 'Under Construction - Jun 2027',
            amenities: [
                '5-tier clubhouse',
                'Rooftop infinity pool',
                'Sky lounge',
                'Private theater',
                'Spa and salon',
                'Wine cellar',
                'Concierge service',
                'Helipad'
            ],
            highlights: 'Ultra-luxury high-rise living with panoramic city views',
            nearby: 'Orion Mall (2 km), Yeshwanthpur Metro (3 km), Palace Grounds (5 km)'
        },
        'insignia': {
            name: 'SOBHA Insignia',
            type: 'Exclusive Waterfront Villas',
            location: 'Whitefield, East Bangalore',
            configurations: '4 & 5 BHK Villas',
            size: '4 BHK: 3500 sq.ft | 5 BHK: 4500 sq.ft',
            price: '₹3.5 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Waterfront living',
                'Private gardens',
                'Exclusive clubhouse',
                'Swimming pool',
                'Gymnasium',
                'Tennis court',
                'Kids play area',
                'Smart home automation'
            ],
            highlights: 'Ultra-premium waterfront villas with lake views',
            nearby: 'ITPL (5 km), Varthur Lake (adjacent), Whitefield (3 km)'
        },
        'one world': {
            name: 'SOBHA One World',
            type: 'Integrated Township',
            location: 'Sarjapur, Bangalore',
            configurations: 'Apartments & Villas',
            size: '2-4 BHK Apartments | 3-4 BHK Villas',
            price: '₹80 Lakhs onwards',
            possession: 'Phased - Multiple towers ready',
            amenities: [
                '100+ amenities',
                'International school',
                'Retail boulevard',
                'Healthcare center',
                'Multiple clubhouses',
                'Sports academy',
                'Convention center',
                'Landscaped parks'
            ],
            highlights: 'Self-sustained township with world-class infrastructure',
            nearby: 'Sarjapur Road (2 km), Electronic City (12 km), HSR Layout (8 km)'
        },
        'galera': {
            name: 'SOBHA Galera',
            type: '2, 3 & 4 BHK Apartments',
            location: 'Tavarekere, South Bangalore',
            configurations: '2 BHK, 3 BHK & 4 BHK',
            size: '2 BHK: 1200 sq.ft | 3 BHK: 1700 sq.ft | 4 BHK: 2300 sq.ft',
            price: '₹75 Lakhs onwards',
            possession: 'Dec 2026',
            amenities: [
                'Modern clubhouse',
                'Swimming pool',
                'Gym and aerobics',
                'Indoor games',
                'Library',
                'Children\'s play area',
                'Jogging track',
                'Amphitheater'
            ],
            highlights: 'Affordable SOBHA quality in premium South Bangalore',
            nearby: 'Bannerghatta Road (5 km), BTM Layout (7 km), Electronic City (15 km)'
        },
        'altair': {
            name: 'SOBHA Altair',
            type: 'Premium 3 & 4 BHK Apartments',
            location: 'Kanakapura Road, Bangalore',
            configurations: '3 BHK & 4 BHK',
            size: '3 BHK: 1900 sq.ft | 4 BHK: 2600 sq.ft',
            price: '₹1.1 Cr onwards',
            possession: 'Ready to Move',
            amenities: [
                'Premium clubhouse',
                'Swimming pool',
                'Tennis court',
                'Squash court',
                'Gymnasium',
                'Yoga deck',
                'Indoor games',
                'Party hall'
            ],
            highlights: 'Premium apartments near Art of Living Ashram',
            nearby: 'Art of Living (5 km), Nice Road (3 km), Rajarajeshwari Nagar (8 km)'
        },
        'neopolis': {
            name: 'SOBHA Neopolis',
            type: '2 & 3 BHK Urban Apartments',
            location: 'Panathur, East Bangalore',
            configurations: '2 BHK & 3 BHK',
            size: '2 BHK: 1150 sq.ft | 3 BHK: 1650 sq.ft',
            price: '₹70 Lakhs onwards',
            possession: 'Ready to Move',
            amenities: [
                'Clubhouse',
                'Swimming pool',
                'Gym',
                'Indoor games',
                'Children\'s play area',
                'Jogging track',
                'Security',
                'Power backup'
            ],
            highlights: 'Contemporary urban living near Outer Ring Road',
            nearby: 'Outer Ring Road (2 km), Sarjapur Road (4 km), Marathahalli (8 km)'
        },
        'town park': {
            name: 'SOBHA Town Park',
            type: 'Premium Villa Plots',
            location: 'Bannerghatta Road, Bangalore',
            configurations: 'Plots 1200-2400 sq.ft',
            size: '30x40, 40x60, 50x80 plots',
            price: '₹60 Lakhs onwards',
            possession: 'Ready to Construct',
            amenities: [
                'Gated community',
                'Clubhouse',
                'Swimming pool',
                'Children\'s park',
                'Paved roads',
                'Street lights',
                'Underground drainage',
                '24/7 security'
            ],
            highlights: 'DTCP approved villa plots from trusted SOBHA',
            nearby: 'IIM Bangalore (8 km), Electronic City (18 km), Nice Ring Road (5 km)'
        },
        'dream acres': {
            name: 'SOBHA Dream Acres',
            type: 'Luxury Villas',
            location: 'Varthur, East Bangalore',
            configurations: '3 & 4 BHK Villas',
            size: '3 BHK: 2200 sq.ft | 4 BHK: 3000 sq.ft',
            price: '₹2.2 Cr onwards',
            possession: 'Upcoming - Launch Q3 2026',
            amenities: [
                'Premium villa community',
                'Private gardens',
                'Clubhouse with pool',
                'Gymnasium',
                'Tennis court',
                'Children\'s play area',
                'Jogging track',
                'Smart home features'
            ],
            highlights: 'Upcoming luxury villa project near Whitefield',
            nearby: 'Whitefield (8 km), Varthur Lake (2 km), ITPL (10 km)'
        }
    }
};

// Helper function to search projects
function findProject(builder, query) {
    const builderProjects = projectDatabase[builder.toLowerCase()];
    if (!builderProjects) return null;

    query = query.toLowerCase();

    // Direct key match
    for (let key in builderProjects) {
        if (query.includes(key) || key.includes(query)) {
            return builderProjects[key];
        }
    }

    // Search by project name
    for (let key in builderProjects) {
        if (builderProjects[key].name.toLowerCase().includes(query)) {
            return builderProjects[key];
        }
    }

    return null;
}

// Format project info into readable text
function formatProjectInfo(project) {
    if (!project) return null;

    return `${project.name} is located in ${project.location}. It offers ${project.type} with ${project.configurations}. ${project.highlights}

Key Features:
${project.amenities.slice(0, 5).map(a => `• ${a}`).join('\n')}

Price: ${project.price}
Possession: ${project.possession}
Nearby: ${project.nearby}`;
}

module.exports = {
    projectDatabase,
    findProject,
    formatProjectInfo
};
