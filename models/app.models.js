const fs = require("fs/promises");
const db = require("../db/connection");
const format = require("pg-format");

exports.getEndpointsFromFile = () => {
  return fs.readFile(`${__dirname}/../endpoints.json`).then((contents) => {
    return JSON.parse(contents);
  });
};

exports.getTopicsFromDatabase = () => {
  return db.query(`SELECT * FROM topics`).then(({ rows }) => rows);
};

exports.getArticlesFromDatabase = (sort_by, order, topic, article_id) => {
  const allowedOrder = ["asc", "desc"];
  const values = [];
  if (!order) order = "desc";
  if (!allowedOrder.includes(order))
    return Promise.reject({ msg: "bad request", status: 400 });
  let query = `SELECT articles.author, articles.title, articles.article_id, articles.topic, articles.created_at, articles.votes, articles.article_img_url, CAST(COUNT(comments.comment_id) AS INT) AS comment_count`;
  if (article_id) query += `, articles.body`;
  query += ` FROM articles
  LEFT JOIN comments ON comments.article_id = articles.article_id`;
  if (topic) {
    query += ` WHERE articles.topic = $1`;
    values[0] = topic;
  }
  if (article_id) {
    query += ` WHERE articles.article_id = $1`;
    values[0] = article_id;
  }
  query += ` GROUP BY articles.article_id`;
  if (!sort_by) query += ` ORDER BY created_at ${order}`;
  else query += ` ORDER BY ${sort_by} ${order}`;
  return db.query(query, values).then(({ rows }) => {
    if (!rows.length) return Promise.reject({ msg: "not found", status: 404 });
    return rows.map((article) => {
      article.created_at = String(article.created_at);
      return article;
    });
  });
};

exports.getCommentsFromDatabase = (article_id) => {
  const values = [];
  let query = `SELECT * FROM comments`;
  if (article_id) {
    query += ` WHERE article_id = $1`;
    values[0] = article_id;
  }
  query += ` ORDER BY created_at DESC`;
  return db.query(query, values).then(({ rows }) => {
    return rows.map((comment) => {
      comment.created_at = String(comment.created_at);
      return comment;
    });
  });
};

exports.addCommentToDatabase = (article_id, username, body) => {
  const array = [[article_id, username, body]];
  const query = `INSERT INTO comments(article_id, author, body) 
  VALUES %L
  RETURNING *`;
  const formattedQuery = format(query, array);
  return db.query(formattedQuery).then(({ rows }) => {
    rows[0].created_at = String(rows[0].created_at);
    return rows[0];
  });
};

exports.incrementArticleVotes = (article_id, inc_votes) => {
  const values = [article_id, inc_votes];
  return db
    .query(
      `UPDATE articles SET votes = votes + $2 WHERE article_id = $1 RETURNING *`,
      values
    )
    .then(({ rows: [article] }) => article);
};

exports.checkArticleExists = (article_id) => {
  const values = [article_id];
  return db
    .query(`SELECT * FROM articles WHERE article_id = $1`, values)
    .then(({ rows }) => {
      if (!rows.length)
        return Promise.reject({ msg: "article not found", status: 404 });
    });
};

exports.deleteCommentFromDatabase = (comment_id) => {
  const values = [comment_id];
  return db.query(`DELETE FROM comments WHERE comment_id = $1`, values);
};

exports.checkCommentExists = (comment_id) => {
  const values = [comment_id];
  return db
    .query(`SELECT * FROM comments WHERE comment_id = $1`, values)
    .then(({ rows }) => {
      if (!rows.length)
        return Promise.reject({ msg: "comment not found", status: 404 });
    });
};

exports.getUsersFromDatabase = () => {
  return db.query(`SELECT * FROM users`).then(({ rows }) => rows);
};

exports.checkColumnNameExists = (tableName, columnName) => {
  if (columnName) {
    const query = format(`SELECT %I FROM %I`, columnName, tableName);
    return db.query(query);
    // error code 42703 when column doesn't exist, caught in app.js
  }
};

exports.checkUserExists = (username) => {
  const values = [username];
  if (username)
    return db
      .query(`SELECT * FROM users WHERE username = $1`, values)
      .then(({ rows }) => {
        if (!rows.length)
          return Promise.reject({ msg: "username not found", status: 404 });
      });
};

exports.checkValidQueries = async (validQueriesArr, inputQueriesObj) => {
  for (let query of Object.keys(inputQueriesObj)) {
    if (!validQueriesArr.includes(query))
      return Promise.reject({ msg: "bad request", status: 400 });
  }
};
