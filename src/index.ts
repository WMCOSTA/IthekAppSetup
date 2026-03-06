// Import the framework and instantiate it
import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
//import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { auth } from "./lib/auth.js";

//import { title } from "process";
//import { z } from "zod/v4";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Será removido porque não usaremos o Swagger para reinderizar a documentação da
// aplicação e sim o Scalar.

/*
await app.register(fastifySwaggerUI, {
  routePrefix: "/docs",
});
*/

// Registrando a URL do frontend - Será detalhada melhor na aula do front

await app.register(fastifyCors, {
  origin: ["http://localhost:3000"],
  credentials: true,
});

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "App I-Thék-Treinos API",
      description: "API para o App de Treinos I-Thék",
      version: "1.0.0",
    },
    servers: [
      {
        description: "localhost",
        url: "http://localhost:8081",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

// Registrando a biblioteca do Scalar
await app.register(fastifyApiReference, {
  routePrefix: "/docs",
  configuration: {
    // informe/descreva abaixo quais APIs queremos documentar
    sources: [
      {
        title: "I-Thék Treinos API",
        slug: "ithek-treinos-api",
        url: "/swagger.json", // Qual arquivo o Scalar vai lê para gerar a documentação
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generete-schema", // URL da API do better-auth será usada para gerar documentação
      },
    ],
  },
});

//Criação da Rota para url: "/swagger.json"
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

/* 
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Olá Williams",
    tags: ["Olá Williams! Bem vindo a documentação com o Swagger"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: "Aloô Williams",
    };
  },
});

 */

// Register authentication endpoint TODA ROTA QUE COMEÇAR POR "/api/auth/*",
//  O BETTER-AUTH IRÁ CUIDAR DELA
//Como funciona...  "app.route"? ele PEGA A URL, PEGAR OS HEADERS, FAZER UMA
// REQUEST E CHAMAR O MEU AUTH

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      // Construct request URL
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Convert Fastify headers to standard Headers object
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      // Process authentication request
      const response = await auth.handler(req);
      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      //app.log.error("Authentication Error:", error);
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

// Run the server!
try {
  // Necessário conversão porque toda variavel de ambiente vem como string
  await app.listen({ port: Number(process.env.PORT) || 8081 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
