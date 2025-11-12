import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { format, toZonedTime } from 'date-fns-tz';
import { map } from 'rxjs/operators';
// import { toZonedTime, format } from 'date-fns-tz';

const TIMEZONE = 'America/Mexico_City';

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => this.convertDates(data)));
  }

  private convertDates(obj: any): any {
    if (obj instanceof Date) {
      // Convierte el Date UTC a hora local (CDMX) en formato ISO
      const zonedDate = toZonedTime(obj, TIMEZONE);
      return format(zonedDate, "yyyy-MM-dd'T'HH:mm:ssXXX", {
        timeZone: TIMEZONE,
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertDates(item));
    }

    if (obj && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = this.convertDates(obj[key]);
      }
      return newObj;
    }

    return obj;
  }
}
