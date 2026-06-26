import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { MainModule } from './modules/main.module';

@Module({
  imports: [EventEmitterModule.forRoot(), ScheduleModule.forRoot(), MainModule],
  controllers: [AppController],
})
export class AppModule {}
