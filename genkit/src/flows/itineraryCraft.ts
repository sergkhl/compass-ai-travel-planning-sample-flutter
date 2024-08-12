import { retrieve } from '@genkit-ai/ai/retriever'
import { prompt } from '@genkit-ai/dotprompt'
import { defineFlow, run } from '@genkit-ai/flow'
import { z } from 'zod'
import { placeRetriever } from '../retrievers/placeRetriever'
import { Destination, ItineraryGeneratorOutput, ItineraryRequest } from '../common/types'
import { planItinerary } from './shared/itineraryCore'
import { searchYoutubeAndExtract } from './shared/youtubeData'

export const itineraryCraft = defineFlow(
  {
    name: 'itineraryCraft',
    inputSchema: ItineraryRequest,
    outputSchema: z.unknown(),
  },
  async (userInputs) => {
    console.log('RUNNING - itineraryCraft')

    // #region : 1 - Obtain the description of the image
    const imageDescription = await run('Describe Image', async () => {
      if (!userInputs.images || userInputs.images.length === 0 || userInputs.images[0] == '') {
        return ''
      }

      const imageDescriptionPrompt = await prompt('imageDescription')
      const result = await imageDescriptionPrompt.generate({
        input: { images: userInputs.images },
      })

      return result.text()
    })
    // #endregion

    // #region : 2.0 - Get the transcripts of the videos
    const possibleDestinationsFromYoutube = await run('Get Youtube Suggested Destinations', async () => {
      const youtubeTranscripts = await searchYoutubeAndExtract(userInputs.request, 1)
      const suggestDestinationsFromCaptionsAgentPrompt = await prompt('suggestDestinationsFromCaptions')

      const result = await suggestDestinationsFromCaptionsAgentPrompt.generate({
        input: { description: youtubeTranscripts },
      })

      const { activities } = result.output() as { activities: Destination[] }
      return activities
    })
    // #endregion

    // #region : 2.1 - Suggest Destinations matching users input
    // const captions = await getTranscript()
    const possibleDestinations = await run('Suggest Destinations', async () => {
      // #region : Retriever
      const contextDestinations = await retrieve({
        retriever: placeRetriever,
        query: `${imageDescription} ${userInputs.request}`,
        options: {
          k: 3,
        },
      })
      // #endregion

      const suggestDestinationsAgentPrompt = await prompt('suggestDestinationsWithContextAgent')
      const result = await suggestDestinationsAgentPrompt.generate({
        input: { description: `${imageDescription} ${userInputs.request}` },
        context: contextDestinations,
      })

      const { destinations } = result.output() as { destinations: Destination[] }

      // #region : Clean Up images
      destinations.forEach((dest) => {
        const doc1 = contextDestinations.find((doc) => doc.toJSON().metadata!.ref === dest.ref)
        if (doc1) {
          dest.imageUrl = doc1.toJSON().metadata!.imageUrl
        }
      })
      // #endregion

      return destinations
    })
    // #endregion

    return { possibleDestinations, possibleDestinationsFromYoutube }
    /*
    // #region : 3 - Plan itineraries for each destination
    let destDetails: Promise<unknown>[] = []

    possibleDestinations.forEach((dest) => {
      const loc0 = run(`Plan Itinerary for Destination: ` + dest.ref, (): Promise<unknown> => {
        return planItinerary(userInputs.request!, dest)
      })
      destDetails.push(loc0)
    })
    //#endregion

    // #region 4 - Merge everything together and tide up data model
    const itineraries = await run('Finally Merge all Results into Itinerary', async () => {
      const results = await Promise.all(destDetails)
      const itineraries = { itineraries: [...(results as ItineraryGeneratorOutput[])] }
      return itineraries
    })
    // #endregion

    return itineraries */
  }
)
