import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { HttpAdapterHost } from '@nestjs/core';
import { get } from 'lodash';
import { getCode, getErrorMessage, isHttpException } from './error.utils';

/**
 * Catch and format thrown exception in NestJS application based on Express
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {  }

  /**
   * Catch and format thrown exception
   */
  // tslint:disable-next-line: no-any
  public catch(exception: any, host: ArgumentsHost): void {
    const adapter = this.httpAdapterHost.httpAdapter;
    const ctx: HttpArgumentsHost = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    let status: number;

    if (isHttpException(exception)) {
      status = exception.getStatus();
    } else {
      // Case of a PayloadTooLarge
      const type: string | undefined = get(exception, 'type');
      status = type === 'entity.too.large' ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.INTERNAL_SERVER_ERROR;
    }

    let code: string =
      isHttpException(exception)
        ? getCode(exception.getResponse())
        : HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR];
    let message: string =
      isHttpException(exception)
        ? getErrorMessage(exception.getResponse())
        : 'An internal server error occurred.';

    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      code = HttpStatus[HttpStatus.PAYLOAD_TOO_LARGE];
      message = `
        Your request entity size is too big for the server to process it:
          - request size: ${get(exception, 'length')};
          - request limit: ${get(exception, 'limit')}.`;
    }
    const exceptionStack: string = 'stack' in exception ? exception.stack : '';
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          message: `${status} [${request.method} ${request.url}] has thrown a critical error`,
          headers: request.headers,
        },
        exceptionStack,
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn({
        message: `${status} [${request.method} ${request.url}] has thrown an HTTP client error`,
        exceptionStack,
        headers: request.headers,
      });
    }
    adapter.reply(response, {
      code,
      message,
      status,
    }, status);
  }
}
