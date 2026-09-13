import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@telepathy/types';

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
