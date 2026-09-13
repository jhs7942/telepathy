import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@telepathy/types';
import { AppService } from './app.service.js';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
