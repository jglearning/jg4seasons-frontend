// 생성 파일 — 직접 고치지 않는다. npm run api:sync

export interface paths {
    "/api/v1/admin/classes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 반 목록
         * @description id 순, 가입 코드 포함. status를 빼면 전부
         */
        get: operations["list_1"];
        put?: never;
        /**
         * 반 생성
         * @description 진도표 24회(개강일 포함, 수업 요일마다, 공휴일 미반영)와 가입 코드를 함께 만든다. 없는 권·잘못된 요일·이름은 400(errors[].field), 다른 학원·비활성 교사는 404. X-CSRF 필요
         */
        post: operations["create_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/classes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 반 상세
         * @description 다른 학원 반은 404
         */
        get: operations["find"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 반 변경
         * @description 빠진 칸은 그대로. 권·개강일·요일은 바꿀 수 없음(새 반으로). active가 아니면 그 반 가입 코드로 입장할 수 없음. teacherIds는 전체 교체. 다른 학원 반·교사는 404. X-CSRF 필요
         */
        patch: operations["update_1"];
        trace?: never;
    };
    "/api/v1/admin/classes/{id}/access-code/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 가입 코드 재발급
         * @description 옛 코드로는 새로 입장할 수 없고, 이미 로그인한 학생은 그대로. 감사 로그에 남는다. 다른 학원 반은 404. X-CSRF 필요
         */
        post: operations["regenerateAccessCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/teachers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 교사·관리자 목록
         * @description id 순
         */
        get: operations["list"];
        put?: never;
        /**
         * 교사 생성
         * @description 아이디가 이미 있으면(전체 학원, 대소문자 무관) 409 LOGIN_ID_TAKEN, 다른 학원 반이 있으면 404. X-CSRF 필요
         */
        post: operations["create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/teachers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 교사 변경
         * @description 빠진 칸은 그대로. 자기 비활성화는 409 SELF_CHANGE_NOT_ALLOWED, 다른 학원 교사·반은 404. 비활성화·비밀번호 재설정이면 그 교사의 refresh를 모두 끊음. X-CSRF 필요
         */
        patch: operations["update"];
        trace?: never;
    };
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
    "/api/v1/auth/staff/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 교사·관리자 로그인
         * @description 성공하면 Set-Cookie access·refresh(14일)·csrf. 틀리면 401 INVALID_CREDENTIALS(없는 아이디와 틀린 비밀번호를 구분하지 않음), 같은 계정 5회 실패면 10분 동안 423 LOCKED(확장 필드 until). 시도는 IP당 1분 10회(429, 성공·실패 모두). 아이디는 대소문자 구분 없음. CSRF 검사 없음
         */
        post: operations["staffLogin"];
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
    "/api/v1/listening/flush": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 청취 구간 전송
         * @description 같은 세션의 같은 구간은 다시 세지 않는다(멱등). 잘못된 세그먼트는 버리고 dropped로 알린다(200). 어느 소속 반 진도표에도 없는 회차 트랙 404, 수업일 전 423 LESSON_LOCKED(소속 반이 둘이면 어느 반에서든 열렸으면 받는다), 다른 학생·트랙의 세션 id 400. CSRF는 헤더 X-CSRF 또는 바디 csrf(sendBeacon)
         */
        post: operations["flush"];
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
    "/api/v1/student/classes/{classId}/lessons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회차 목록
         * @description 묶음(8회차씩)별 회차와 상태(completed·today·overdue·open·locked). 내가 지금 소속된 active 반만, 다른 학원·남의 반·퇴원한 반은 404
         */
        get: operations["lessons"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/student/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학생 홈
         * @description 오늘 수업(수업일이 지난 회차 중 가장 늦은 것)·밀린 수업(ADR-24)·오늘 단어·다음 수업·통계. 오늘 = 학원 타임존 날짜. 현재 소속 반이 없으면 404
         */
        get: operations["home"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/student/lessons/{lessonCode}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회차 상세
         * @description 지문·문장·속도별 음원·문장 시각·들은 구간·완료 상태. 소속 반이 둘이면 어느 반에서든 열렸으면 연다. 어느 소속 반 진도표에도 없는 회차(다른 권 포함)는 404, 수업일 전(학원 타임존)·휴강만 있는 회차는 423 LESSON_LOCKED
         */
        get: operations["detail"];
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
        AccessCodeResponse: {
            /** @description 새 가입 코드 8자 */
            accessCode: string;
            /**
             * Format: date-time
             * @description 발급 시각(UTC, 초 단위)
             */
            codeIssuedAt: string;
        };
        BookInfo: {
            /** @example L2-B1 */
            code: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을";
        };
        ClassCreateRequest: {
            /**
             * @description 권 코드(예: L2-B1). 없는 권이면 400 VALIDATION(bookCode)
             * @example L2-B1
             */
            bookCode: string;
            /** @description 앞뒤 공백을 뺀 1~50자. 같은 학원 안에서 겹쳐도 됨 */
            name: string;
            /**
             * Format: date
             * @description 개강일(학원 날짜). 지난 날짜도 됨. 이날이 수업 요일이면 1회차
             */
            startDate: string;
            /** @description 담당 교사 id. 그 학원의 활성 교사·관리자만(아니면 404). 빈 배열 허용 */
            teacherIds: number[];
            /**
             * @description 수업 요일 1(월)~7(일), 하나 이상, 겹침 없음. 아니면 400 VALIDATION(weekdays)
             * @example [
             *       1,
             *       3
             *     ]
             */
            weekdays: number[];
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
        ClassLessonsGroup: {
            /**
             * @description 시즌 이름 + 묶음 번호
             * @example 겨울 1
             */
            label: string;
            lessons: components["schemas"]["ClassLessonsLesson"][];
            /**
             * Format: int32
             * @description 묶음 번호 1~3
             */
            module: number;
            range: components["schemas"]["ClassLessonsRange"];
        };
        ClassLessonsLesson: {
            /** @example L2-B1-05 */
            code: string;
            /** Format: int32 */
            number: number;
            progress: components["schemas"]["LessonProgressView"];
            /**
             * Format: date
             * @description 진도표 수업일(휴강 뒤 옮겨졌으면 새 날짜)
             */
            scheduledDate: string;
            /**
             * @description open = 수업일 전이지만 열림(미래 회차 허용 반), locked = 수업일 전 또는 휴강만 있음
             * @enum {string}
             */
            state: "completed" | "today" | "overdue" | "open" | "locked";
            title: string;
            /** @enum {string} */
            type: "regular" | "module_review" | "integrated";
        };
        ClassLessonsRange: {
            /**
             * Format: date
             * @description 묶음 첫 수업일
             */
            from: string;
            /**
             * Format: date
             * @description 묶음 마지막 수업일
             */
            to: string;
        };
        ClassLessonsResponse: {
            class: components["schemas"]["StudentClassInfo"];
            groups: components["schemas"]["ClassLessonsGroup"][];
        };
        ClassListResponse: {
            items: components["schemas"]["ClassResponse"][];
            /** Format: int32 */
            total: number;
        };
        ClassRef: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        ClassResponse: {
            /** @description 가입 코드 8자 */
            accessCode: string;
            allowFutureLessons: boolean;
            /** @example L2-B1 */
            bookCode: string;
            /**
             * Format: date-time
             * @description 가입 코드 발급 시각(UTC, 초 단위)
             */
            codeIssuedAt: string;
            /** Format: int64 */
            id: number;
            /** @example L2 */
            levelCode: string;
            name: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을";
            /**
             * Format: date
             * @description 개강일(학원 날짜)
             */
            startDate: string;
            /** @enum {string} */
            status: "active" | "finished" | "archived";
            /**
             * Format: int32
             * @description 현재 소속 학생 수
             */
            studentCount: number;
            /** @description 담당 교사(id 오름차순) */
            teachers: components["schemas"]["ClassTeacher"][];
            /** @description 수업 요일 1(월)~7(일), 오름차순 */
            weekdays: number[];
        };
        ClassTeacher: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        ClassUpdateRequest: {
            /** @description 미래 회차 미리 듣기 허용 */
            allowFutureLessons?: boolean;
            /** @description 앞뒤 공백을 뺀 1~50자 */
            name?: string;
            /**
             * @description active가 아니면 그 반 가입 코드로 입장할 수 없음. 세 값 사이 자유롭게 바꿀 수 있음
             * @enum {string}
             */
            status?: "active" | "finished" | "archived";
            /** @description 담당 교사 id 전체(교체). 빈 배열이면 모두 해제. 새로 넣는 교사는 그 학원의 활성 교사·관리자만(아니면 404), 이미 이 반 담당인 교사는 비활성이어도 그대로 둘 수 있음 */
            teacherIds?: number[];
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
        FlushLesson: {
            /** @example L2-B1-05 */
            code: string;
            /**
             * Format: int32
             * @description 완료한 지문 수
             */
            requiredDone: number;
            /**
             * Format: int32
             * @description 지문 수
             */
            requiredTotal: number;
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
        };
        FlushRequest: {
            /**
             * @description 트랙 재생 시작 때 클라이언트가 만든 UUID. 재전송·멱등 키
             * @example 7c2e0000-0000-4000-8000-000000000001
             */
            clientSessionId: string;
            /** @description sendBeacon(text/plain)일 때만. fetch는 헤더 X-CSRF */
            csrf?: string;
            /** @description pause·ended·pagehide에서 true. 서버 동작은 같다 */
            final?: boolean;
            /** @description 빈 배열 허용. 앞 50개만 보고 나머지는 dropped */
            segments: components["schemas"]["FlushSegment"][];
            /**
             * Format: date-time
             * @description 세션 시작 시각(클라이언트, 첫 flush만 저장)
             */
            startedAt: string;
            /** Format: int64 */
            trackId: number;
            /** @description 첫 flush만 저장, 200자에서 자름 */
            userAgent?: string;
        };
        FlushResponse: {
            /**
             * Format: int32
             * @description 버린 세그먼트 수(범위·길이·빠진 칸·50개 초과). 재전송 중복은 세지 않음
             */
            dropped: number;
            lesson: components["schemas"]["FlushLesson"];
            track: components["schemas"]["FlushTrack"];
        };
        FlushSegment: {
            /**
             * Format: int32
             * @description 트랙 안 끝(ms), 시작보다 큼
             */
            endMs: number;
            /**
             * Format: date-time
             * @description 기록 시각(클라이언트)
             */
            recordedAt: string;
            /**
             * Format: int32
             * @description 트랙 안 시작(ms)
             */
            startMs: number;
        };
        FlushTrack: {
            /** @description 완료 기준 도달(한 번 되면 유지) */
            completed: boolean;
            /** @description 청취율 0~1 */
            coverage: number;
            /** Format: int64 */
            trackId: number;
        };
        LessonDetailCompletion: {
            /** Format: int32 */
            passagesDone: number;
            /** Format: int32 */
            passagesTotal: number;
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
            /** @description 트랙 완료 기준 청취율(0~1) */
            threshold: number;
        };
        LessonDetailLesson: {
            /** @example L2-B1-05 */
            code: string;
            /** Format: int32 */
            number: number;
            /** @example Reading Day 5 */
            title: string;
            /** @enum {string} */
            type: "regular" | "module_review" | "integrated";
        };
        LessonDetailLevel: {
            /** @example L2 */
            code: string;
            /** @example #1F7A4F */
            colorHex: string;
            /** @example 그린 */
            nameKo: string;
        };
        LessonDetailPassage: {
            /** Format: int32 */
            no: number;
            sentences: components["schemas"]["LessonDetailSentence"][];
            speeds: components["schemas"]["LessonDetailSpeed"][];
            title: string;
            /** Format: int32 */
            wordCount: number;
        };
        LessonDetailResponse: {
            completion: components["schemas"]["LessonDetailCompletion"];
            lesson: components["schemas"]["LessonDetailLesson"];
            level: components["schemas"]["LessonDetailLevel"];
            passages: components["schemas"]["LessonDetailPassage"][];
            words: components["schemas"]["LessonDetailWords"];
        };
        LessonDetailSentence: {
            /** Format: int32 */
            no: number;
            /** @description 대화문 화자. 대화문이 아니면 null */
            speaker: string | null;
            text: string;
        };
        LessonDetailSpeed: {
            /** @description 같은 도메인 상대 경로 */
            audioUrl: string;
            completed: boolean;
            /** @description 청취율 0~1(병합된 구간 / 길이) */
            coverage: number;
            /**
             * Format: int32
             * @description 음원 길이(ms)
             */
            durationMs: number;
            /** @description 병합된 들은 구간 [시작, 끝] ms. 들은 적 없으면 빈 배열 */
            heardRanges: number[][];
            /** @description 지문 완료에 필요한 속도인가(완료 규칙 결과) */
            required: boolean;
            /** @description timings[i] = sentences[i]의 [시작, 끝] ms. 문장 시각이 아직 없으면 빈 배열 */
            timings: number[][];
            /** @description true면 1.0 시각을 길이 비율로 늘이거나 줄인 근사 */
            timingsApproximate: boolean;
            /** Format: int64 */
            trackId: number;
            /**
             * @description 속도(0.8·1.0·1.2)
             * @example 1.0
             */
            variant: string;
        };
        LessonDetailWords: {
            /**
             * Format: int32
             * @description 암기 모드 '알아요' 최고 수
             */
            memKnown: number;
            /**
             * Format: int32
             * @description 회차 단어 수
             */
            total: number;
        };
        LessonProgressView: {
            /**
             * Format: int32
             * @description 완료한 지문 수
             */
            passagesDone: number;
            /**
             * Format: int32
             * @description 지문 수(콘텐츠가 아직 없으면 0)
             */
            passagesTotal: number;
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
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
        StaffLoginRequest: {
            /**
             * @description 영문·숫자·.·_·- 3~30자. 대소문자 구분 없음, 앞뒤 공백은 서버가 정리
             * @example teacher01
             */
            loginId: string;
            /** @description 8~72자 */
            password: string;
        };
        StaffLoginResponse: {
            user: components["schemas"]["UserInfo"];
        };
        StudentClassBook: {
            /** @example L2-B1 */
            code: string;
            /**
             * @description 머리글 표시 이름
             * @example Book 1
             */
            label: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을";
        };
        StudentClassInfo: {
            book: components["schemas"]["StudentClassBook"];
            /** Format: int64 */
            id: number;
            level: components["schemas"]["StudentClassLevel"];
            /** @example 겨울 그린 A반 */
            name: string;
        };
        StudentClassLevel: {
            /** @example L2 */
            code: string;
            /** @example #1F7A4F */
            colorHex: string;
            /** @example 그린 */
            nameKo: string;
        };
        StudentHomeLessonRef: {
            code: string;
            title: string;
        };
        StudentHomeNext: {
            lesson: components["schemas"]["StudentHomeLessonRef"];
            /** Format: date */
            scheduledDate: string;
            /** Format: int32 */
            seq: number;
        };
        StudentHomeOtherClass: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        StudentHomeOverdue: {
            /**
             * @description not_started 미참여 · stopped 멈춤
             * @enum {string}
             */
            kind: "not_started" | "stopped";
            lesson: components["schemas"]["StudentHomeLessonRef"];
            progress: components["schemas"]["LessonProgressView"];
            /** Format: date */
            scheduledDate: string;
            /** Format: int32 */
            seq: number;
        };
        StudentHomePassageTitle: {
            /** Format: int32 */
            no: number;
            title: string;
        };
        StudentHomeResponse: {
            class: components["schemas"]["StudentClassInfo"];
            /** @description 수업일이 오늘 뒤인 가장 이른 회차. 종강 뒤면 null */
            next: components["schemas"]["StudentHomeNext"] | null;
            otherClasses: components["schemas"]["StudentHomeOtherClass"][];
            /** @description 밀린 수업(ADR-24), 오래된 순. 없으면 빈 배열 */
            overdue: components["schemas"]["StudentHomeOverdue"][];
            stats: components["schemas"]["StudentHomeStats"];
            /** @description 수업일이 지난 회차 중 가장 늦은 것. 개강 전이면 null */
            today: components["schemas"]["StudentHomeToday"] | null;
            /** @description 오늘 회차의 단어. 오늘 회차가 없으면 null */
            words: components["schemas"]["StudentHomeWords"] | null;
        };
        StudentHomeStats: {
            /** Format: int32 */
            completedLessons: number;
            /**
             * Format: int32
             * @description overdue 배열 길이와 같다
             */
            overdueLessons: number;
            /**
             * Format: int32
             * @description 진도표 회차 수
             */
            totalLessons: number;
        };
        StudentHomeToday: {
            /**
             * @description 시즌 이름 + 묶음 번호
             * @example 겨울 1
             */
            groupLabel: string;
            lesson: components["schemas"]["StudentHomeTodayLesson"];
            progress: components["schemas"]["LessonProgressView"];
            /** Format: date */
            scheduledDate: string;
            /** Format: int32 */
            seq: number;
        };
        StudentHomeTodayLesson: {
            /** @example L2-B1-05 */
            code: string;
            /** Format: int32 */
            number: number;
            passages: components["schemas"]["StudentHomePassageTitle"][];
            title: string;
            /** @enum {string} */
            type: "regular" | "module_review" | "integrated";
        };
        StudentHomeWords: {
            lessonCode: string;
            /**
             * Format: int32
             * @description 암기 모드 '알아요' 최고 수
             */
            memKnown: number;
            /**
             * Format: int32
             * @description 회차 단어 수
             */
            total: number;
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
        TeacherCreateRequest: {
            /** @description 담당 반 id. 없으면 빈 배열 */
            classIds: number[];
            /** @description 영문·숫자·.·_·- 3~30자. 대소문자 구분 없음(소문자로 저장), 전체 학원에서 고유 */
            loginId: string;
            /** @description 1~30자 */
            name: string;
            /** @description 8자 이상, 72바이트 이하 */
            password: string;
            /** @enum {string} */
            role: "teacher" | "admin";
        };
        TeacherListResponse: {
            items: components["schemas"]["TeacherResponse"][];
            /** Format: int32 */
            total: number;
        };
        TeacherResponse: {
            /** @description 담당 반 id(오름차순) */
            classIds: number[];
            /** Format: int64 */
            id: number;
            /**
             * Format: date-time
             * @description 한 번도 로그인하지 않았으면 null(UTC)
             */
            lastLoginAt: string | null;
            /** @description 로그인 수단이 없으면 null */
            loginId: string | null;
            name: string;
            /** @enum {string} */
            role: "teacher" | "admin";
            /** @enum {string} */
            status: "active" | "inactive";
        };
        TeacherUpdateRequest: {
            /** @description 담당 반 id 전체(교체). 빈 배열이면 모두 해제 */
            classIds?: number[];
            /** @description 1~30자 */
            name?: string;
            /** @description 비밀번호 재설정(8자 이상, 72바이트 이하). 잠금이 풀리고 그 교사의 refresh를 모두 끊음 */
            password?: string;
            /**
             * @description inactive면 로그인·refresh 불가, 그 교사의 refresh를 모두 끊음
             * @enum {string}
             */
            status?: "active" | "inactive";
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
    list_1: {
        parameters: {
            query?: {
                /** @description active · finished · archived */
                status?: string;
            };
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
                    "*/*": components["schemas"]["ClassListResponse"];
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
    create_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClassCreateRequest"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ClassResponse"];
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
    find: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
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
                    "*/*": components["schemas"]["ClassResponse"];
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
    update_1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClassUpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["ClassResponse"];
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
    regenerateAccessCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
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
                    "*/*": components["schemas"]["AccessCodeResponse"];
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
    list: {
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
                    "*/*": components["schemas"]["TeacherListResponse"];
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
    create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TeacherCreateRequest"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TeacherResponse"];
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
    update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TeacherUpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["TeacherResponse"];
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
    staffLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffLoginRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StaffLoginResponse"];
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
    flush: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FlushRequest"];
                "text/plain": components["schemas"]["FlushRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["FlushResponse"];
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
    lessons: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                classId: number;
            };
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
                    "*/*": components["schemas"]["ClassLessonsResponse"];
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
    home: {
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
                    "*/*": components["schemas"]["StudentHomeResponse"];
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
    detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /**
                 * @description 회차 코드
                 * @example L2-B1-05
                 */
                lessonCode: string;
            };
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
                    "*/*": components["schemas"]["LessonDetailResponse"];
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
