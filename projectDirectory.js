// Builder → projects, as supplied by the CRM team. Luna passes these names on a
// lead, so Kaira must recognise them even though only six builders have their
// own bot — everything else is served by the general 'all' bot.
//
// Names are kept exactly as the CRM holds them, duplicates and all, so a lookup
// here matches what Luna sends. Do not "tidy" them without changing the CRM too.
const projectDirectory = {
    'Abhee Developers': ['Abhee Aaria', 'Abhee Celestial City', 'Abhee Eden Vista', 'Abhee New Dimension', 'Abhee Plots Sarjapur', 'Abhee Riviera Royale', 'Abhee Tranquila'],
    'Adarsh Developers': ['Adarsh Greens', 'Adarsh Palm Retreat', 'Adarsh Savana', 'Adarsh Welkin Park'],
    'Ajmera Realty': ['Ajmera Lugaano', 'Ajmera Nucleus'],
    'Aratt Developers': ['Aratt Divya Jyothi', 'Aratt Felicita'],
    'Arvind SmartSpaces': ['Arvind Oasis', 'Arvind Sarjapur Road', 'Arvind Skylands'],
    'Assetz': ['Assetz 63 Degree East', 'Assetz Canvas and Cove', 'Assetz Earth and Essence', 'Assetz Marq 2.0', 'Assetz Sun and Sanctum'],
    'Assetz Property Group': ['Assetz Micropolis'],
    'Bhartiya City': ['Leela Residences', 'Nikoo Homes'],
    'Birla Estates': ['Birla Alokya', 'Birla Tisya', 'Birla Trimaya'],
    'Brigade': ['Brigade Cornerstone Utopia', 'Brigade El Dorado', 'Brigade Insignia', 'Brigade Komarla Heights', 'Brigade Meadows', 'Brigade Sanctuary', 'Brigade Valencia', 'Brigade Woods'],
    'Brigade Group': ['Brigade Kadugodi'],
    'Casagrand': ['Casagrand Athens', 'Casagrand Estancia', 'Casagrand Utopia', 'Casagrand Zenith'],
    'Century Real Estate': ['Century Breeze', 'Century Ethos', 'Century Wintersun'],
    'Concorde': ['Concorde Antares', 'Concorde Napa Valley'],
    'DivyaSree': ['DivyaSree 77 East', 'DivyaSree Republic of Whitefield'],
    'DSR Infrastructure': ['DSR Evoq', 'DSR Reflections', 'DSR White Waters'],
    'Embassy': ['Embassy Boulevard', 'Embassy Edge', 'Embassy Grove', 'Embassy Lake Terraces', 'Embassy Springs'],
    'Fortune Group': ['Fortune Primero'],
    'Godrej Garden City': ['Godrej Air', 'Godrej Woodsman Estate'],
    'Godrej Properties': ['Godrej Ananda', 'Godrej Bannerghatta', 'Godrej Coimbatore Plots', 'Godrej Lakeside Orchard', 'Godrej MSR City', 'Godrej Park Retreat', 'Godrej Reflections', 'Godrej Regent Park', 'Godrej Royale Woods', 'Godrej Splendour', 'Godrej Villas Whitefield', 'Godrej Woodscapes'],
    'Hiranandani': ['Hiranandani Devanahalli', 'Hiranandani Glen Gate'],
    'Kolte-Patil': ['Kolte-Patil iTowers Exente'],
    'L&T Realty': ['L&T Raintree Boulevard'],
    'Lodha': ['Lodha Azur', 'Lodha HSR Extension', 'Lodha Mirabelle', 'Lodha Whitefield'],
    'Mahaveer Group': ['Mahaveer Ranches', 'Mahaveer Sitara'],
    'Mahindra Lifespaces': ['Mahindra Eden', 'Mahindra Windchimes', 'Mahindra Zen'],
    'Mana Skanda': ['Mana The Right Life'],
    'Mantri Developers': ['Mantri Energia', 'Mantri Lithos', 'Mantri Serenity', 'Mantri Webcity'],
    'Mhyna': ['Myhna Vistara'],
    'Modern Spaaces': ['Modern Spaaces Ivy County'],
    'Modi Builders': ['Modi Emerald Heights'],
    'Nambiar Builders': ['Nambiar Bannerghatta Villas', 'Nambiar Bellezea', 'Nambiar District 25', 'Nambiar Ellegenza', 'Nambiar Phase 3'],
    'Nitesh Estates': ['Nitesh Chelsea', 'Nitesh Park Avenue'],
    'NVT Quality Lifestyle': ['NVT Green Wood', 'NVT Villas Sarjapur'],
    'Ozone Group': ['Ozone Urbana'],
    'Prestige': ['Prestige Falcon City', 'Prestige Finsbury Park', 'Prestige Kings County', 'Prestige Lakeside Habitat', 'Prestige Park Grove', 'Prestige Primrose Hills', 'Prestige Song of the South', 'Prestige Waterford'],
    'Prestige Group': ['Prestige Plots Devanahalli', 'Prestige Southern Star'],
    'Prime Developers': ['Prime Jade Gardens', 'Prime Meadows'],
    'Provident Housing': ['Provident Botanico', 'Provident Capella', 'Provident Ecopolitan', 'Provident Sunworth'],
    'Puravankara': ['Purva Atmosphere', 'Purva Park Hill', 'Purva Sound of Water', 'Purva Zenium'],
    'Purva Land': ['Purva Aerocity', 'Purva Tivoli Hills'],
    'Ramky Estates': ['Ramky Discovery City', 'Ramky One Odyssey'],
    'Renaissance Holdings': ['Renaissance Nature Walk', 'Renaissance Temple Bells'],
    'Rohan Builders': ['Rohan Akriti', 'Rohan Upavan'],
    'Salarpuria': ['Salarpuria Sattva Divinity', 'Salarpuria Sattva Misty Charm'],
    'Sattva Group': ['Sattva Misty Charm', 'Sattva Park Cubix', 'Sattva Songbird'],
    'Shapoorji Pallonji': ['Joyville Bangalore', 'Parkwest'],
    'Shriram Properties': ['Shriram Chirping Grove', 'Shriram Greenfield', 'Shriram Liberty Square', 'Shriram Southern Crest'],
    'SJR Group': ['SJR Blue Waters', 'SJR Palazza City', 'SJR Parkway Homes'],
    'SNN Builders': ['SNN Clermont', 'SNN Raj Etternia', 'SNN Raj Lakeview', 'SNN Raj Serenity'],
    'Sobha': ['Sobha Dream Acres', 'Sobha Hennur', 'Sobha Hoskote', 'Sobha Insignia', 'Sobha Magnum', 'Sobha Manhattan Towers', 'Sobha Mysuru', 'Sobha Neopolis', 'Sobha Resale', 'Sobha Royal Crest', 'Sobha Royal Pavilion', 'Sobha Sacred Grove Chikkatirupati', 'Sobha Scarlet', 'Sobha Sentosa', 'Sobha Townpark', 'Sobha Victoria Park', 'Sobha Windsor'],
    'Sowparnika': ['Sowparnika Ashiyana', 'Sowparnika Unnathi'],
    'Sterling Developers': ['Sterling Ascentia', 'Sterling Infinia'],
    'Sumadhura': ['Sumadhura Aikya', 'Sumadhura Eden Garden', 'Sumadhura Folium'],
    'Tata Housing': ['Tata Carnatica', 'Tata New Haven', 'Tata Promont'],
    'Total Environment': ['After the Rain', 'In That Quiet Earth', 'Pursuit of a Radical Rhapsody', 'The Magic Faraway Tree', 'Total Environment Sarjapur'],
    'Trendsquares': ['Trendsquares Panathur', 'Trendsquares Whitefield'],
    'Vaishnavi Estates': ['Vaishnavi North 24', 'Vaishnavi Terraces'],
    'Vaishnavi Group': ['Vaishnavi North 24', 'Vaishnavi Oasis', 'Vaishnavi Serene'],
    'Vakil Housing': ['Vakil Garden City', 'Vakil Whispering Woods'],
    'Unknown': ['36 Park Avenue'],
    'Various': ['Plotted Coimbatore'],
    'Unknown builder': ['Diggaj Greens', 'Diggaj Riverfront', 'Diggaj Skyline']
};

// Placeholders, not real builder names. Kaira must never introduce herself as
// "Kaira from Unknown" - the project still routes, the builder is just omitted.
const PLACEHOLDER_BUILDERS = new Set(['Unknown', 'Unknown builder', 'Various']);

module.exports = { projectDirectory, PLACEHOLDER_BUILDERS };
