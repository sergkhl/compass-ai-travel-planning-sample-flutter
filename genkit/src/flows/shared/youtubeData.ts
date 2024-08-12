import { YoutubeTranscript } from 'youtube-transcript'
import { youtube, youtube_v3 } from '@googleapis/youtube'

export async function getTranscript(videoId: string): Promise<string> {
  const transcript = await YoutubeTranscript.fetchTranscript(videoId)
  const formattedTranscript = transcript.map((item) => item.text).join(' ')
  return formattedTranscript
}

const youtubeClient = youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_DATA_API_KEY,
})

interface YoutubeSearchResult {
  videoId?: string | null
  title?: string | null
  description?: string | null
  thumbnails?: string | null
  url?: string | null
}

const mapYoutubeSearchResult = (video: youtube_v3.Schema$SearchResult): YoutubeSearchResult => {
  return {
    videoId: video.id?.videoId,
    title: video.snippet?.title,
    description: video.snippet?.description,
    thumbnails: video.snippet?.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${video.id?.videoId}`,
  }
}

export async function searchYoutube(query: string, maxResults: number = 5, pageToken?: string) {
  const response = await youtubeClient.search.list({
    part: ['snippet'],
    // part: 'id,snippet',
    maxResults: maxResults,
    pageToken: pageToken,
    q: query,
    videoCaption: 'closedCaption',
    type: ['video'],
  })

  return response?.data?.items?.map(mapYoutubeSearchResult) ?? []
}

export async function getYoutubeTranscripts(searchResponse: YoutubeSearchResult[]): Promise<string> {
  const results: string[] = []

  for (const searchResult of searchResponse) {
    let resultText = `Video ID: ${searchResult.videoId}\n`
    resultText += `Video URL: ${searchResult.url}\n`
    resultText += `Title: ${searchResult.title}\n`

    if (searchResult.videoId) {
      const transcript = await getTranscript(searchResult.videoId)
      resultText += '```\n'
      resultText += transcript
      resultText += '\n```\n'
    }

    results.push(resultText)
  }

  return results.join('\n')
}

export async function searchYoutubeAndExtract(query: string, maxResults: number = 2): Promise<string> {
  const searchResponse = await searchYoutube(query, maxResults)
  return await getYoutubeTranscripts(searchResponse)
}
