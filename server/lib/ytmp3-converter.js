import fetch from 'node-fetch';
import Encoder from './encoder.js';

class Ytmp3Converter {
  constructor() {
    this.baseUrl = "https://ytmp3.as/";
    console.log("[LOG] Ytmp3Converter initialized.");
  }

  enc(data) {
    const { uuid: jsonUuid } = Encoder.enc({
      data: data,
      method: "combined"
    });
    return jsonUuid;
  }

  dec(uuid) {
    const decryptedJson = Encoder.dec({
      uuid: uuid,
      method: "combined"
    });
    return decryptedJson.text;
  }

  getBaseHeaders() {
    return {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "u=0, i",
      "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
    };
  }

  getRandomString(name) {
    return name?.trim()?.length ? name : parseInt(Math.random().toString().substring(2)).toString(36).substring(4);
  }

  tryEval(description, input) {
    try {
      console.log(`[LOG] Evaluating: ${description}`);
      return eval(input);
    } catch (error) {
      console.error(`[ERROR] Failed to evaluate ${description}: ${error.message}`);
      throw new Error(`Failed to evaluate. Description: ${description}. Error: ${error.message}`);
    }
  }

  validateString(description, theVariable) {
    if (typeof theVariable !== "string" || theVariable?.trim()?.length === 0) {
      console.error(`[ERROR] Validation failed: ${description} must be a non-empty string.`);
      throw new Error(`Variable ${description} must be a non-empty string.`);
    }
  }

  extractYotubeId(url) {
    let match;
    try {
      console.log(`[LOG] Extracting YouTube ID from URL: ${url}`);
      if (url.includes("youtu.be")) {
        match = /\/([a-zA-Z0-9\-_]{11})/.exec(url);
      } else if (url.includes("youtube.com")) {
        if (url.includes("/shorts/")) {
          match = /\/([a-zA-Z0-9\-_]{11})/.exec(url);
        } else {
          match = /v=([a-zA-Z0-9\-_]{11})/.exec(url);
        }
      } else {
        match = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9\-_]{11})/.exec(url);
      }
      if (!match?.[1]) {
        console.error(`[ERROR] Could not extract YouTube ID from URL: ${url}`);
        throw new Error(`Could not extract YouTube ID from URL: ${url}`);
      }
      console.log(`[LOG] Extracted YouTube ID: ${match[1]}`);
      return match[1];
    } catch (error) {
      console.error(`[ERROR] Failed to extract YouTube ID from URL ${url}: ${error.message}`);
      throw new Error(`URL ${url} is not supported or invalid. Error: ${error.message}`);
    }
  }

  async hit(description, url, options, returnType = 'text') {
    try {
      console.log(`[LOG] Hitting URL for ${description}: ${url}`);
      let data;
      const r = await fetch(url.toString(), options);
      if (!r.ok) {
        const errorText = await r.text().catch(() => "(response was empty)");
        console.error(`[ERROR] HTTP error for ${description}: ${r.status} ${r.statusText}\n${errorText}`);
        throw new Error(`${r.status} ${r.statusText}\n${errorText}`);
      }
      try {
        if (returnType === "text") {
          data = await r.text();
        } else if (returnType === "json") {
          data = await r.json();
        } else {
          console.warn(`[WARN] Unknown returnType: ${returnType}. Defaulting to text.`);
          data = await r.text();
        }
      } catch (error) {
        console.error(`[ERROR] Failed to parse response as ${returnType} for ${description}: ${error.message}`);
        throw new Error(`Failed to convert response to ${returnType}. ${error.message}`);
      }
      console.log(`[LOG] Successfully hit URL for ${description}.`);
      return {
        data: data,
        response: r
      };
    } catch (error) {
      console.error(`[ERROR] Hit function failed for ${description}: ${error.message}`);
      throw new Error(`Hit function failed. Description: ${description}. Error: ${error.message}`);
    }
  }

  async getAuth(identifier) {
    try {
      console.log(`[LOG] [${identifier}] Starting getAuth process.`);
      const headersHitHomepage = {
        ...this.getBaseHeaders()
      };
      const base = new URL(this.baseUrl);
      const {
        data: homepageHTML,
        response: homepageResponse
      } = await this.hit(`download html homepage`, base.origin, {
        headers: headersHitHomepage
      });
      const newHomepageUrl = new URL(homepageResponse.url);
      if (base.origin !== newHomepageUrl.origin) {
        console.log(`[LOG] [${identifier}] Redirected from [${base.origin}] to [${newHomepageUrl.origin}]`);
      }
      const code1 = homepageHTML.match(/<script>(.+?)<\/script>/)?.[1];
      if (!code1) {
        console.error(`[ERROR] [${identifier}] No match found for initial script in homepage HTML.`);
        throw new Error(`No match found for initial script in homepage HTML.`);
      }
      const jsPath = homepageHTML.match(/<script src="(.+?)" defer>/)?.[1];
      if (!jsPath) {
        console.error(`[ERROR] [${identifier}] No match found for JS path in homepage HTML.`);
        throw new Error(`No match found for JS path.`);
      }
      const jsUrl = newHomepageUrl.origin + jsPath;
      const headersHitJs = {
        referer: newHomepageUrl.href,
        ...this.getBaseHeaders()
      };
      delete headersHitJs.priority;
      delete headersHitJs["sec-fetch-user"];
      delete headersHitJs["upgrade-insecure-requests"];
      const {
        data: js
      } = await this.hit(`download js`, jsUrl, {
        headers: headersHitJs
      });
      const sdh = js.match(/function decodeHex(.+?)return(:?.+?)}/g)?.[0];
      if (!sdh) {
        console.error(`[ERROR] [${identifier}] No match found for decodeHex function in JS file.`);
        throw new Error(`No match found for decodeHex function.`);
      }
      const decodeHex = this.tryEval(`getting decodeHex function`, `${sdh}decodeHex`);
      const sdb = js.match(/function decodeBin(.+?)return(:?.+?)}/g)?.[0];
      if (!sdb) {
        console.error(`[ERROR] [${identifier}] No match found for decodeBin function in JS file.`);
        throw new Error(`No match found for decodeBin function.`);
      }
      const decodeBin = this.tryEval(`getting decodeBin function`, `${sdb}decodeBin`);
      const sa = js.match(/function authorization(.+?)return(:?.+?)}}/g)?.[0];
      if (!sa) {
        console.error(`[ERROR] [${identifier}] No match found for authorization function in JS file.`);
        throw new Error(`No match found for authorization function.`);
      }
      const final = `${code1};${decodeBin};${decodeHex};${sa}authorization`;
      const authorization = this.tryEval(`assembling HTML cipher, decodeBin function, and getting authorization function`, final);
      const sRootDomain = js.match(/gB=String.fromCharCode\((.+?)\)/)?.[0];
      if (!sRootDomain) {
        console.error(`[ERROR] [${identifier}] No match found for root domain in JS file.`);
        throw new Error(`No match found for root domain.`);
      }
      const gB = this.tryEval(`getting root domain`, `const ${sRootDomain};gB`);
      const sInitApi = js.match(/"GET","(.+?)\?/)?.[1];
      if (!sInitApi) {
        console.error(`[ERROR] [${identifier}] No match found for init API in JS file.`);
        throw new Error(`No match found for init API.`);
      }
      const initUrl = this.tryEval(`getting init API`, `const gB="${gB}";"${sInitApi}"`);
      const authKey = decodeHex(this.tryEval(`getting authKey`, `${code1};gC.d(3)[1]`));
      const authValue = authorization();
      console.log(`[LOG] [${identifier}] Successfully retrieved authentication details.`);
      return {
        authKey: authKey,
        authValue: authValue,
        initUrl: initUrl,
        newHomepageUrl: newHomepageUrl
      };
    } catch (error) {
      console.error(`[ERROR] [${identifier}] getAuth function failed: ${error.message}`);
      throw new Error(`getAuth function failed for ${identifier}. Error: ${error.message}`);
    }
  }

  async init(identifier) {
    try {
      console.log(`[LOG] [${identifier}] Starting init process.`);
      const {
        authKey,
        authValue,
        initUrl,
        newHomepageUrl
      } = await this.getAuth(identifier);
      const baseUrl = newHomepageUrl;
      const headers = {
        origin: baseUrl.origin,
        referer: baseUrl.href,
        ...this.getBaseHeaders()
      };
      delete headers["sec-fetch-user"];
      delete headers["upgrade-insecure-requests"];
      const api = new URL(initUrl);
      api.search = `${authKey}=${authValue}&_=${Math.random()}`;
      const {
        data
      } = await this.hit(`init`, api, {
        headers: headers
      }, "json");
      if (data.error !== "0") {
        console.error(`[ERROR] [${identifier}] API init returned an error: ${JSON.stringify(data, null, 2)}`);
        throw new Error(`API init returned an error. JSON: ${JSON.stringify(data, null, 2)}`);
      }
      if (!data.convertURL) {
        console.error(`[ERROR] [${identifier}] Convert URL is missing from init response.`);
        throw new Error(`Convert URL is missing from init response.`);
      }
      console.log(`[LOG] [${identifier}] Successfully initialized with convert URL.`);
      return {
        convertUrl: data.convertURL,
        newHomepageUrl: newHomepageUrl
      };
    } catch (error) {
      console.error(`[ERROR] [${identifier}] init function failed: ${error.message}`);
      throw new Error(`init function failed for ${identifier}. Error: ${error.message}`);
    }
  }

  async convert(videoId, format, identifier) {
    try {
      console.log(`[LOG] [${identifier}] Starting convert process for video ID: ${videoId}, format: ${format}`);
      const {
        convertUrl,
        newHomepageUrl
      } = await this.init(identifier);
      const url = new URL(convertUrl);
      url.searchParams.append("v", videoId);
      url.searchParams.append("f", format);
      url.searchParams.append("_", Math.random().toString());
      const baseUrl = newHomepageUrl;
      const headers = {
        connection: "keep-alive",
        host: url.hostname,
        origin: baseUrl.origin,
        referer: baseUrl.href,
        ...this.getBaseHeaders()
      };
      delete headers.priority;
      delete headers["sec-fetch-user"];
      delete headers["upgrade-insecure-requests"];
      const {
        data: convertResponse
      } = await this.hit(`convert`, url, {
        headers: headers
      }, "json");
      if (convertResponse.error !== 0) {
        console.error(`[ERROR] [${identifier}] Convert API returned an error: ${JSON.stringify(convertResponse, null, 2)}`);
        throw new Error(`Convert API returned an error. Response: ${JSON.stringify(convertResponse, null, 2)}`);
      }
      console.log(`[LOG] [${identifier}] Successfully initiated conversion.`);
      return {
        convert: convertResponse,
        newHomepageUrl: newHomepageUrl
      };
    } catch (error) {
      console.error(`[ERROR] [${identifier}] convert function failed: ${error.message}`);
      throw new Error(`Convert function failed. Identifier: ${identifier}. Error: ${error.message}`);
    }
  }

  async progress(videoId, format, identifier) {
    try {
      console.log(`[LOG] [${identifier}] Starting progress check for video ID: ${videoId}, format: ${format}`);
      const {
        convert: convertResult,
        newHomepageUrl
      } = await this.convert(videoId, format, identifier);
      const baseUrl = newHomepageUrl;
      const headers = {
        connection: "keep-alive",
        host: (convertResult.redirectURL || convertResult.progressURL).hostname,
        origin: baseUrl.origin,
        referer: baseUrl.href,
        ...this.getBaseHeaders()
      };
      if (convertResult.redirectURL) {
        const {
          data: redirect
        } = await this.hit(`redirect`, convertResult.redirectURL, {
          headers: headers
        }, "json");
        if (redirect.error !== 0) {
          console.error(`[ERROR] [${identifier}] Redirect URL returned an error: ${JSON.stringify(redirect, null, 2)}`);
          throw new Error(`Redirect URL returned an error. Raw JSON: ${JSON.stringify(redirect, null, 2)}`);
        }
        if (!redirect.downloadURL) {
          console.error(`[ERROR] [${identifier}] Download URL is missing from redirect response.`);
          throw new Error(`Download URL is missing from redirect URL result.`);
        }
        console.log(`[LOG] [${identifier}] Conversion completed via redirect.`);
        return {
          identifier: identifier,
          title: redirect.title,
          format: format,
          downloadURL: redirect.downloadURL,
          status: "completed"
        };
      } else if (convertResult.progressURL) {
        const {
          data: progressData
        } = await this.hit(`progress`, convertResult.progressURL, {
          headers: headers
        }, "json");
        if (progressData.error !== 0) {
          console.error(`[ERROR] [${identifier}] Progress check returned an error. Ensure video duration is less than 45 minutes. JSON: ${JSON.stringify(progressData)}`);
          throw new Error(`Progress check returned an error. Ensure video duration is less than 90 minutes. Error JSON: ${JSON.stringify(progressData)}`);
        }
        if (progressData.progress === 3) {
          console.log(`[LOG] [${identifier}] Conversion completed on single progress check.`);
          return {
            identifier: identifier,
            title: progressData.title,
            format: format,
            downloadURL: convertResult.downloadURL,
            status: "completed"
          };
        } else {
          console.log(`[LOG] [${identifier}] Conversion still in progress. Current progress: ${progressData.progress}`);
          return {
            identifier: identifier,
            title: progressData.title,
            format: format,
            progress: progressData.progress,
            status: "in_progress"
          };
        }
      } else {
        console.error(`[ERROR] [${identifier}] Neither redirectURL nor progressURL found in convert response.`);
        throw new Error("Neither redirectURL nor progressURL found in convert response.");
      }
    } catch (error) {
      console.error(`[ERROR] [${identifier}] progress function failed: ${error.message}`);
      throw new Error(`Progress check function failed. Identifier: ${identifier}. Error: ${error.message}`);
    }
  }

  async download({
    url,
    format = "mp3",
    userIdentifier = null
  }) {
    try {
      console.log(`[LOG] Starting direct download for URL: ${url}, format: ${format}`);
      this.validateString(`url`, url);
      const validFormat = ["mp3", "mp4"];
      if (!validFormat.includes(format)) {
        console.error(`[ERROR] Invalid format: ${format}. Valid formats are ${validFormat.join(", ")}.`);
        throw new Error(`Invalid format: ${format}. Valid formats are ${validFormat.join(", ")}`);
      }
      const youtubeId = this.extractYotubeId(url);
      const identifier = this.getRandomString(userIdentifier);
      console.log(`[LOG] [DIRECT CONVERSION] ${identifier}`);
      
      // Directly process and wait for completion
      const result = await this.progress(youtubeId, format, identifier);
      
      // Only return if we have a download URL
      if (result.status === "completed" && result.downloadURL) {
        console.log(`[LOG] [${identifier}] Conversion completed successfully`);
        return {
          title: result.title,
          format: result.format,
          downloadURL: result.downloadURL,
          identifier: result.identifier
        };
      } else {
        // If not completed yet, keep polling until we get the download URL
        let attempts = 0;
        const maxAttempts = 30; // Maximum 30 attempts (about 5 minutes with 10 second intervals)
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
          
          try {
            const checkResult = await this.progress(youtubeId, format, identifier);
            if (checkResult.status === "completed" && checkResult.downloadURL) {
              console.log(`[LOG] [${identifier}] Conversion completed after ${attempts} attempts`);
              return {
                title: checkResult.title,
                format: checkResult.format,
                downloadURL: checkResult.downloadURL,
                identifier: checkResult.identifier
              };
            }
            console.log(`[LOG] [${identifier}] Still processing... Attempt ${attempts}/${maxAttempts}`);
          } catch (pollError) {
            console.log(`[LOG] [${identifier}] Polling attempt ${attempts} failed: ${pollError.message}`);
          }
        }
        
        throw new Error(`Conversion timeout: Video could not be processed within the time limit`);
      }
    } catch (error) {
      console.error(`[ERROR] Download failed: ${error.message}`);
      throw new Error(`Download failed. Error: ${error.message}`);
    }
  }


}

export default Ytmp3Converter;