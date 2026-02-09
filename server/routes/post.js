const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');

/**
 * @route   GET /api/posts/stats
 * @desc    통계 집계 (학원별, 소스별, 기간별)
 * 주의: 이 라우트는 /:id 보다 먼저 선언해야 합니다
 */
router.get('/stats', async (req, res) => {
  try {
    const { academy, source, startDate, endDate } = req.query;

    const match = {};
    if (academy) match.academy = require('mongoose').Types.ObjectId.createFromHexString(academy);
    if (source) match.source = require('mongoose').Types.ObjectId.createFromHexString(source);
    if (startDate || endDate) {
      match.postedAt = {};
      if (startDate) match.postedAt.$gte = new Date(startDate);
      if (endDate) match.postedAt.$lte = new Date(endDate);
    }

    // 학원별 집계
    const byAcademy = await Post.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$academy',
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$viewCount' },
          totalComments: { $sum: '$commentCount' },
          samplePosts: { $sum: { $cond: ['$isSample', 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'academies',
          localField: '_id',
          foreignField: '_id',
          as: 'academy'
        }
      },
      { $unwind: { path: '$academy', preserveNullAndEmptyArrays: true } },
      { $sort: { totalPosts: -1 } }
    ]);

    // 소스별 집계
    const bySource = await Post.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$sourceType',
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$viewCount' }
        }
      },
      { $sort: { totalPosts: -1 } }
    ]);

    // 전체 통계
    const total = await Post.countDocuments(match);

    res.json({
      success: true,
      data: {
        total,
        byAcademy,
        bySource
      }
    });
  } catch (error) {
    console.error('[Post] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/posts
 * @desc    게시글 목록 (페이징, 필터)
 */
router.get('/', async (req, res) => {
  try {
    const { academy, keyword, source, sourceType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (academy) filter.academy = academy;
    if (keyword) filter.keyword = { $regex: keyword, $options: 'i' };
    if (source) filter.source = source;
    if (sourceType) filter.sourceType = sourceType;
    if (startDate || endDate) {
      filter.postedAt = {};
      if (startDate) filter.postedAt.$gte = new Date(startDate);
      if (endDate) filter.postedAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate('academy', 'name slug')
      .populate('source', 'name sourceType')
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('[Post] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/posts/:id
 * @desc    게시글 상세 (댓글 포함)
 */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('academy', 'name slug')
      .populate('source', 'name sourceType url');

    if (!post) {
      return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다' });
    }

    const comments = await Comment.find({ post: post._id }).sort({ commentedAt: 1 });

    res.json({
      success: true,
      data: {
        ...post.toObject(),
        comments
      }
    });
  } catch (error) {
    console.error('[Post] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
