// 생성 파일 — 직접 고치지 않는다. npm run api:sync

export interface paths {
    "/api/v1/auth/code/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 가입 코드로 반 확인(S-01 입력 중 표시용)
         * @description IP당 1분에 10회. 반이 없거나 비활성이거나 학원이 정지면 404 INVALID_CODE, 넘으면 429 RATE_LIMITED. CSRF 검사 없음
         */
        post: operations["verify"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 로그아웃
         * @description refresh를 폐기하고 쿠키 3개를 만료시킨다. 헤더 X-CSRF 필요
         */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 세션 갱신
         * @description 요청 바디 없음. refresh 쿠키로 새 access·refresh·csrf를 발급한다(refresh 회전). 쿠키가 없거나 무효면 401. CSRF 검사 없음. 회전된 지 10초 안의 옛 refresh는 200(쿠키 그대로 — 다른 탭이 받은 쿠키를 같이 씀), 그 뒤에 오면 그 사용자 refresh를 모두 끊고 401
         */
        post: operations["refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/student/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 가입 코드 + 개인 코드로 학생 입장
         * @description 성공하면 Set-Cookie access·refresh·csrf. 틀리면 401 INVALID_CREDENTIALS(어느 쪽이 틀렸는지 구분하지 않음), (반, IP) 5회 실패면 10분 동안 423 LOCKED(확장 필드 until). CSRF 검사 없음
         */
        post: operations["studentLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 내 정보
         * @description access 쿠키가 없거나 만료면 401 UNAUTHORIZED
         */
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AcademyRef: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        BookInfo: {
            /** @example L2-B1 */
            code: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을";
        };
        ClassInfo: {
            academyName: string;
            book: components["schemas"]["BookInfo"];
            /** Format: int64 */
            id: number;
            level: components["schemas"]["LevelInfo"];
            /** @example 겨울 그린 A반 */
            name: string;
        };
        ClassRef: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        CodeVerifyRequest: {
            /**
             * @description 가입 코드(영숫자 8자). 소문자·앞뒤 공백은 서버가 정리한다
             * @example G7KM2XP4
             */
            code: string;
        };
        CodeVerifyResponse: {
            class: components["schemas"]["ClassInfo"];
        };
        LevelInfo: {
            /** @example L2 */
            code: string;
            /**
             * @description #RRGGBB
             * @example #1F7A4F
             */
            colorHex: string;
            /** @example 그린 */
            nameKo: string;
        };
        MeResponse: {
            academy: components["schemas"]["AcademyRef"];
            /** Format: int64 */
            id: number;
            name: string;
            /** @enum {string} */
            role: "student" | "teacher" | "admin" | "superadmin";
        };
        /** @description RFC 9457 Problem Details + 확장 code·requestId */
        Problem: {
            /** @description 분기용 오류 code(예: VALIDATION, INVALID_CREDENTIALS) */
            code: string;
            /** @description 사용자에게 보여 줄 설명(한국어) */
            detail?: string;
            /** @description 400 VALIDATION일 때만. 칸별 오류 */
            errors?: {
                /** @description 문제 칸 이름. JSON 문법 오류는 body */
                field: string;
                /** @description 사용자에게 보여 줄 한국어 문구 */
                message: string;
            }[];
            /** @description 요청 경로 */
            instance?: string;
            /** @description 응답 헤더 X-Request-Id와 같은 값. 로그 대조용 */
            requestId: string;
            /**
             * Format: int32
             * @description HTTP 상태
             */
            status: number;
            /** @description 사용자에게 보여 줄 제목(한국어) */
            title: string;
            /** @description /problems/{code 소문자-하이픈} */
            type?: string;
            /**
             * Format: date-time
             * @description 423 LOCKED일 때만. 잠금 해제 시각(UTC)
             */
            until?: string;
        };
        StudentLoginRequest: {
            /**
             * @description 가입 코드(영숫자 8자). 소문자·앞뒤 공백은 서버가 정리한다
             * @example G7KM2XP4
             */
            code: string;
            /**
             * @description 개인 코드. 문자열 숫자 4자리, 0으로 시작할 수 있다
             * @example 0423
             */
            personalCode: string;
        };
        StudentLoginResponse: {
            class: components["schemas"]["ClassRef"];
            user: components["schemas"]["UserInfo"];
        };
        UserInfo: {
            /** Format: int64 */
            id: number;
            name: string;
            /** @enum {string} */
            role: "student" | "teacher" | "admin" | "superadmin";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    verify: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CodeVerifyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CodeVerifyResponse"];
                };
            };
            /** @description 오류(Problem Details). 프론트는 code로 분기하고 title·detail을 보여 준다 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 로그아웃됨 */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 오류(Problem Details). 프론트는 code로 분기하고 title·detail을 보여 준다 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["MeResponse"];
                };
            };
            /** @description 오류(Problem Details). 프론트는 code로 분기하고 title·detail을 보여 준다 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    studentLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudentLoginRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StudentLoginResponse"];
                };
            };
            /** @description 오류(Problem Details). 프론트는 code로 분기하고 title·detail을 보여 준다 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["MeResponse"];
                };
            };
            /** @description 오류(Problem Details). 프론트는 code로 분기하고 title·detail을 보여 준다 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
