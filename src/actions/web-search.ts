import { Core } from '@src/core';
import { Logger } from '@src/logger';
import { search, SafeSearchType, searchImages } from 'duck-duck-scrape';
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: `http://127.0.0.1:${process.env.OLLAMA_PORT}` });

export function handleWebQuery(input: string): Promise<string | string[] | false> {
  return new Promise(async (resolve, reject) => {
    try {
      const decision = await decideAction(input);
      Logger.DEBUG(`Decision: ${decision}`);

        // Step 1: Generate a query for the web search
        const prompt = `
        Generate a web search query for the following user input:
        User Input: "${input}"
        Make a short keyword-based query string. Do not add any other information.`
      const { response } = await  ollama.generate({ model: Core.model_name, prompt: prompt });
        
      console.log(response);

      if (decision === 'SEARCH') {
        // Step 2: Perform a web search
        const searchResult = await performSearch(response);
        
        if (searchResult) {
          resolve(searchResult);
        } else {
          resolve("I couldn't find any relevant information. Can you clarify or ask something else?");
        }
      } else if (decision.includes('IMAGE')) {
        const imageResult = await performImageSearch(response);
        if(decision === 'IMAGES') {
          resolve(imageResult);
        } else {
          resolve(imageResult[0]);
        }
      } else if (decision === 'DIRECT') {
        // Step 3: Return false instead of generating a direct response
        resolve(false);
      } else {
        Logger.ERROR(`Unknown decision: ${decision}`);
        resolve("I'm not sure how to handle that. Can you ask in a different way?");
      }
    } catch (error) {
      Logger.ERROR(`Error handling web query: ${error}`);
      reject("Something went wrong while processing your request. Please try again.");
    }
  });
}

// Decide whether the input needs a search or direct response
function decideAction(input: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const taskPrompt = `
        You are a smart assistant. Determine if the user query requires a web search or can be answered directly:
        Respond with "SEARCH" for any of the following cases:
            - The user asks for the weather.
            - The users asks for a specific date, time or person.
            - The user asks for today's date or this whole week.
            - The user asks for specific information about a topic you don't have knowledge of.
            - The user asks for a definition.
            - The user asks for a comparison.
            - The user asks for a list.
            - The user asks for a step-by-step guide.
            - The user asks for a recipe.
        If user query is for an image reply with "IMAGE".
        If user query is for images reply with "IMAGES".
        Any other cases, reply with "DIRECT".
        ---
        User Query: "${input}"
      `;
      const taskResponse = await ollama.generate({ model: Core.model_name, prompt: taskPrompt });
      const decision = taskResponse.response.trim().toUpperCase();
      resolve(decision);
    } catch (error) {
      reject("Error deciding the action.");
    }
  });
}

// Perform a web search using DuckDuckGo
function performSearch(input: string): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const searchResults = await search(input, { safeSearch: SafeSearchType.OFF });
      const topResult = searchResults.results[0];

      Logger.DEBUG(`Search Results: ${JSON.stringify(searchResults)}`);
      
      if (topResult) {
        resolve(promisifySummary(topResult));
      } else {
        resolve(null);  // No relevant search result
      }
    } catch (error) {
      Logger.ERROR(`Error performing web search: ${error}`);
      reject("Error performing the web search.");
    }
  });
}

// Perform an image search using DuckDuckGo
function performImageSearch(input: string): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const searchResults = await searchImages(input, { safeSearch: SafeSearchType.OFF });
      const topResults = searchResults.results.slice(0, 3);

      Logger.DEBUG(`Image Search Results: ${JSON.stringify(searchResults)}`);
      
      if (topResults.length > 0) {
        const imageResults = topResults.map(result => result.source);
        resolve(imageResults);
      } else {
        resolve(["I couldn't find any relevant images."]);
      }
    } catch (error) {
      Logger.ERROR(`Error performing image search: ${error}`);
      reject("Error performing the image search.");
    }
  });
}

// Promisify the summary generation
function promisifySummary(topResult: any): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const summaryPrompt = `
        Summarize the following web search result for the user's query:
        Title: ${topResult.title}
        URL: ${topResult.url}
        Description: ${topResult.description || 'No description available.'}
      `;
      const summaryResponse = await ollama.generate({ model: Core.model_name, prompt: summaryPrompt });
      resolve(summaryResponse.response.trim());
    } catch (error) {
      reject("Error generating summary.");
    }
  });
}
