## Gin

```shell
go get -u github.com/gin-contrib/cors
go get -u github.com/gin-contrib/sessions
go get -u github.com/gin-contrib/sessions/memstore
go get -u github.com/gin-gonic/gin
go get -u github.com/dgrijalva/jwt-go
```

## go-gin

```go
package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

var store = memstore.NewStore([]byte("sk-demo"))
var jwtSecret = []byte("your_jwt_secret_key")

type Claims struct {
	Username string `json:"username"`
	jwt.StandardClaims
}

func main() {
	r := gin.Default()

	// CORS 配置
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"*"}
	r.Use(cors.New(corsConfig))

	// Session 配置
	r.Use(sessions.Sessions("mysession", store))

	// JWT 认证中间件
	jwtMiddleware := func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "No token provided"})
			c.Abort()
			return
		}

		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
		claims := &Claims{}

		tkn, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Failed to parse token"})
			c.Abort()
			return
		}

		if !tkn.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Failed to authenticate token"})
			c.Abort()
			return
		}

		session := sessions.Default(c)
		session.Set("username", claims.Username)
		session.Save()

		c.Next()
	}

	// 登录路由
	r.POST("/login", func(c *gin.Context) {
		username := c.PostForm("username")
		password := c.PostForm("password")

		if username == "admin" && password == "admin" {
			expirationTime := time.Now().Add(5 * time.Minute)
			claims := &Claims{
				Username: username,
				StandardClaims: jwt.StandardClaims{
					ExpiresAt: expirationTime.Unix(),
				},
			}

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			tokenString, err := token.SignedString(jwtSecret)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate token"})
				return
			}

			session := sessions.Default(c)
			session.Set("username", username)
			session.Save()

			c.JSON(http.StatusOK, gin.H{"token": tokenString})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
		}
	})

	// 注册路由
	r.POST("/register", func(c *gin.Context) {
		username := c.PostForm("username")
		password := c.PostForm("password")

		if username != "" && password != "" {
			c.JSON(http.StatusOK, gin.H{"message": "User registered successfully"})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Username and password are required"})
		}
	})

	// 动态路由
	dynamicRouter := r.Group("/", jwtMiddleware, AuthMiddleware())
	{
		dynamicRouter.GET("/dynamic/:id", func(c *gin.Context) {
			id := c.Param("id")
			c.JSON(http.StatusOK, gin.H{"message": "Dynamic route accessed", "id": id})
		})
	}

	// 启动服务器
	r.Run(":8081")
}

// AuthMiddleware 中间件用于验证用户身份
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		username := session.Get("username")
		fmt.Println(username)
		if username == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
			c.Abort()
		} else {
			c.Next()
		}
	}
}
```

## http send

```txt
# go-server.http

## baseurl
@baseurl = http://localhost:8081

## Register a new user
POST {{baseurl}}/register
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin

### Login to get a session cookie
POST {{baseurl}}/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin

### Access the dynamic route with the session cookie
GET {{baseurl}}/dynamic/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNzQ1NjA4MjkwfQ.2vGqT4jjcFVxnZfmskq_t5Tu06J4zQ3zN_NrppXAcjg
```
