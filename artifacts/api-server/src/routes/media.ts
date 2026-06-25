import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";
import {
  searchYouTube,
  searchSpotify,
  SpotifyNotConfiguredError,
} from "../lib/mediaSearch";
import { SearchYoutubeQueryParams, SearchSpotifyQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/media/search/youtube", requireAuth, async (req, res): Promise<void> => {
  const params = SearchYoutubeQueryParams.safeParse(req.query);
  if (!params.success || !params.data.q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  const results = await searchYouTube(params.data.q);
  res.json(results);
});

router.get("/media/search/spotify", requireAuth, async (req, res): Promise<void> => {
  const params = SearchSpotifyQueryParams.safeParse(req.query);
  if (!params.success || !params.data.q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  try {
    const results = await searchSpotify(params.data.q);
    res.json(results);
  } catch (err) {
    if (err instanceof SpotifyNotConfiguredError) {
      res.status(503).json({ error: "Spotify search is not configured" });
      return;
    }
    req.log.error({ err }, "Spotify search failed");
    res.json({ results: [] });
  }
});

export default router;
