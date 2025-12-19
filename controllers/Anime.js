const axios = require('axios')
const fs = require('fs')
const path = require('path')

async function AnimeVideo(query) {
    try {
        console.log(`🔍 Searching for anime: ${query}`)
        
        // AniList GraphQL API
        const graphqlQuery = `
            query ($search: String) {
                Page (perPage: 5) {
                    media (search: $search, type: ANIME, sort: POPULARITY_DESC) {
                        id
                        title {
                            romaji
                            english
                            native
                        }
                        description
                        episodes
                        status
                        genres
                        averageScore
                        coverImage {
                            extraLarge
                            large
                            medium
                            color
                        }
                        bannerImage
                        siteUrl
                        startDate {
                            year
                            month
                            day
                        }
                    }
                }
            }
        `

        const response = await axios.post('https://graphql.anilist.co', {
            query: graphqlQuery,
            variables: { search: query }
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })

        const mediaList = response.data.data.Page.media
        
        if (!mediaList || mediaList.length === 0) {
            throw new Error(`No anime found for "${query}"`)
        }

        const media = mediaList[0]
        const title = media.title.english || media.title.romaji || media.title.native
        
        // FIX: Clean up image URL by removing spaces
        let animeImgUrl = media.coverImage.extraLarge || media.coverImage.large || media.coverImage.medium
        if (animeImgUrl) {
            animeImgUrl = animeImgUrl.replace(/\s/g, '') // Remove all spaces from URL
        }
        
        // Create streaming search URLs
        const streamingSites = [
            {
                name: "Gogoanime",
                url: `https://gogoanime3.co/search.html?keyword=${encodeURIComponent(title)}`
            },
            {
                name: "9anime", 
                url: `https://9anime.pl/search?keyword=${encodeURIComponent(title)}`
            },
            {
                name: "Zoro",
                url: `https://zoro.to/search?keyword=${encodeURIComponent(title)}`
            }
        ]

        const episodes = streamingSites.map((site, index) => ({
            epNo: (index + 1).toString(),
            epTitle: `Watch on ${site.name}`,
            videoUrl: site.url,
            note: `Stream on ${site.name}`
        }))

        return {
            title: title,
            episodes: episodes,
            animeImgUrl: animeImgUrl, // Use cleaned URL
            totalEpisodes: media.episodes,
            description: media.description ? media.description.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : 'No description available',
            genres: media.genres.slice(0, 5),
            status: media.status,
            score: media.averageScore,
            year: media.startDate.year
        }

    } catch (error) {
        console.error('❌ AnimeVideo Error:', error.message)
        throw new Error(`Anime search failed: ${error.message}`)
    }
}

async function downloadImage(url, outputPath) {
    if (!url || url === '') {
        throw new Error('No image URL provided')
    }

    try {
        // Clean the URL - remove spaces and encode properly
        const cleanUrl = url.replace(/\s/g, '').trim()
        console.log(`📥 Downloading image from: ${cleanUrl}`)
        
        // Ensure uploads directory exists
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        const response = await axios({
            url: cleanUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://anilist.co/'
            }
        })

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const writer = fs.createWriteStream(outputPath)
        response.data.pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                // Verify file was created and has content
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath)
                    if (stats.size > 0) {
                        console.log(`✅ Image saved: ${outputPath} (${stats.size} bytes)`)
                        resolve()
                    } else {
                        reject(new Error('Downloaded file is empty'))
                    }
                } else {
                    reject(new Error('File was not created'))
                }
            })
            writer.on('error', (error) => {
                console.error('❌ Write error:', error)
                reject(new Error(`Failed to save image: ${error.message}`))
            })
        })

    } catch (error) {
        console.error('❌ Image download failed:', error.message)
        
        // Clean up partial file if it exists
        if (fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath)
            } catch (unlinkError) {
                console.log('Could not delete partial file:', unlinkError.message)
            }
        }
        
        throw new Error(`Image download failed: ${error.message}`)
    }
}

module.exports = { AnimeVideo, downloadImage }