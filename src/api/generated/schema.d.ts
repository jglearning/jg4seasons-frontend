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
         * @description 진도표(권의 회차 수만큼 — 블랙 28, 그 밖 24회, 개강일 포함, 수업 요일마다, 공휴일 미반영)와 가입 코드를 함께 만든다. 없는 권·잘못된 요일·이름은 400(errors[].field), 다른 학원·비활성 교사는 404. X-CSRF 필요
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
        patch: operations["update_2"];
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
    "/api/v1/admin/classes/{id}/students": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 반 학생 목록
         * @description 현재 소속 학생(이름 순, 같으면 id 순). 개인 코드 평문 없음. 다른 학원 반은 404
         */
        get: operations["list_2"];
        put?: never;
        /**
         * 학생 등록
         * @description 1~50명, 응답은 요청 순서. 학생마다 개인 코드(숫자 4자리, 학원 안 고유)를 발급해 평문을 이 응답에서만 준다(카드 인쇄용, 다시 볼 수 없음). 이름·학교·학년은 앞뒤 공백을 지운다(학교·학년이 비면 null), 같은 이름 허용. 다른 학원 반은 404, 진행 중(active)이 아닌 반은 409 CLASS_NOT_ACTIVE — 둘 다 아무도 만들지 않는다. X-CSRF 필요
         */
        post: operations["create_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/classes/{id}/students/personal-codes/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 개인 코드 여러 명 재발급
         * @description 그 반 현재 소속 학생만 — 하나라도 아니면 404이고 아무도 바꾸지 않는다. 같은 id는 한 번(첫 순서), 응답은 요청 순서. 옛 코드는 바로 못 쓰고 그 학생들의 로그인 유지(refresh)가 모두 끊긴다. 학생마다 감사 로그. X-CSRF 필요
         */
        post: operations["regeneratePersonalCodes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학원 현황
         * @description 진행 중(active) 반 전부(id 순)의 오늘 회차와 그 회차를 완료한 학생 비율(현재 소속 학생 중, 반올림 없음), 오늘 한 번이라도 들은 학생 수. 오늘 = 학원 타임존 날짜(자정 기준), 오늘 들은 학생은 반 소속과 무관하게 그 학원 학생 전부(퇴원 포함)에서 센다
         */
        get: operations["dashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/students/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 학생 이름으로 찾기
         * @description 학원 전체(퇴원 포함), 이름 부분 일치(앞뒤 공백 무시, %·_는 글자 그대로), 이름 순, 최대 50명. class는 지금 반(여럿이면 id가 가장 작은 반), 없으면 null. 이름은 본문으로만. X-CSRF 필요
         */
        post: operations["search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/students/{id}": {
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
         * 학생 변경
         * @description 빠진 칸은 그대로, 이름은 앞뒤 공백을 지움, 학교·학년은 빈 문자열이면 지움. 바꿀 값이 없으면 400. status inactive = 퇴원: 로그인 불가·로그인 유지(refresh) 끊김·반 소속 모두 끝남(기록 보존, 코드는 그대로), 감사 로그. 이미 퇴원이면 아무것도 늘지 않음. active = 되살리기(상태만 — 반은 이동으로). 다른 학원 학생은 404. X-CSRF 필요
         */
        patch: operations["update_1"];
        trace?: never;
    };
    "/api/v1/admin/students/{id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 학생 반 이동
         * @description 지금 반(여럿이면 모두)에서 나가고 새 반 하나에 들어간다. 기록은 남는다. 감사 로그. 다른 학원 학생·반은 404. 퇴원생 409 STUDENT_INACTIVE, 진행 중이 아닌 반 409 CLASS_NOT_ACTIVE, 이미 그 반에만 있으면 409 ALREADY_IN_CLASS. X-CSRF 필요
         */
        post: operations["move"];
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
         * @description refresh를 폐기하고 쿠키 3개(운영은 음원 쿠키 3개도)를 만료시킨다. 헤더 X-CSRF 필요
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
         * @description 요청 바디 없음. refresh 쿠키로 새 access·refresh·csrf(운영은 음원용 CloudFront-* 3개도, 기한 2시간 새로)를 발급한다(refresh 회전). 쿠키가 없거나 무효면 401. CSRF 검사 없음. 회전된 지 10초 안의 옛 refresh는 200(쿠키 그대로 — 다른 탭이 받은 쿠키를 같이 씀), 그 뒤에 오면 그 사용자 refresh를 모두 끊고 401
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
         * @description 성공하면 Set-Cookie access·refresh(14일)·csrf(운영은 음원용 CloudFront-* 3개도). 틀리면 401 INVALID_CREDENTIALS(없는 아이디와 틀린 비밀번호를 구분하지 않음), 같은 계정 5회 실패면 10분 동안 423 LOCKED(확장 필드 until). 시도는 IP당 1분 10회(429, 성공·실패 모두). 아이디는 대소문자 구분 없음. CSRF 검사 없음
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
         * @description 성공하면 Set-Cookie access·refresh·csrf(운영은 음원용 CloudFront-Policy·Signature·Key-Pair-Id도 — Path=/audio/, 2시간). 틀리면 401 INVALID_CREDENTIALS(어느 쪽이 틀렸는지 구분하지 않음), (반, IP) 5회 실패면 10분 동안 423 LOCKED(확장 필드 until). CSRF 검사 없음
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
         * @description 지문·문장·목소리별 음원·문장 시각·들은 구간·완료 상태. 소속 반이 둘이면 어느 반에서든 열렸으면 연다. 어느 소속 반 진도표에도 없는 회차(다른 권 포함)는 404, 수업일 전(학원 타임존)·휴강만 있는 회차는 423 LESSON_LOCKED
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
    "/api/v1/student/lessons/{lessonCode}/word-study": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 카드·학습 결과 저장
         * @description 보낼 칸만, 하나도 없으면 400. 저장된 값보다 작은 값은 무시(단조 증가). 값 범위 0 ~ 회차 단어 수(넘으면 400 VALIDATION, errors[].field = 칸 이름). allViewed는 서버 판정: cardsViewed가 회차 단어 수에 처음 닿은 저장부터 true. 화면을 떠날 때·모드 한 바퀴 끝에 1회. 열림 규칙은 2.4와 같다(404·423). X-CSRF 필요
         */
        put: operations["saveStudy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/student/lessons/{lessonCode}/words": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회차 단어
         * @description 교재 순서: 어휘책 그 강의 단어 → 숙어 → 어휘책에 없는 회차 어휘. source로 출처(book·extra)를 구분한다. 예문 해석·음원이 없는 단어가 있다(null). 단어가 없으면 빈 목록. 열림 규칙은 2.3과 같다: 어느 소속 반 진도표에도 없는 회차 404, 수업일 전·휴강만 있는 회차 423 LESSON_LOCKED
         */
        get: operations["words"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 담당 반 목록
         * @description 진행 중(active) 반, id 순 — 교사는 담당 반, 관리자는 학원 전체. 오늘 회차(학원 날짜, 학생 화면과 같은 규칙)와 그 회차의 완료·진행 중·시작 전 학생 수(현재 소속), 밀린 수업이 있는 학생 수, 다음 수업, 로그인 경고(최근 1시간 반 전체 개인 코드 실패 20회 이상 — since는 그중 가장 오래된 실패 시각)
         */
        get: operations["classes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/lessons/{lessonCode}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 회차 상세
         * @description 학생 × 지문 트랙 표(트랙은 지문 → 목소리 순, 학생은 그 반 현재 소속 이름 순 — 매트릭스와 같은 학생). byTrack은 들은 트랙만. 수업 전 회차도 조회된다. 그 반 권의 회차가 아니거나 없으면 404. 요청한 교사가 비활성화됐으면 401
         */
        get: operations["lesson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/matrix": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 청취 현황 매트릭스
         * @description 학생(현재 소속, 이름 순) × 회차(seq 순). fromSeq·toSeq는 둘 다 보내거나 둘 다 뺀다(빼면 오늘 회차가 든 8개 묶음 1~8·9~16…, 개강 전이면 1~8). 휴강 행은 열로 오지 않는다. 칸은 열린 회차만 학생마다 항상(진도 없으면 not_started, requiredTotal = 지문 수). 교사는 담당 반, 관리자는 학원 반 전부(끝난 반 포함) — 그 밖은 404
         */
        get: operations["matrix"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 진도표
         * @description 휴강 행 포함, seq 순(= 날짜 순, 같은 날은 휴강 행 먼저). 휴강하면 행이 남고 같은 회차가 새 행으로 들어가 행 수가 회차 수보다 많을 수 있다. 요청한 교사가 비활성화됐으면 401, 담당 아닌 반은 404
         */
        get: operations["sessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/sessions/{seq}": {
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
         * 진도표 한 행 수정
         * @description 날짜·메모. 메모는 지난 수업·휴강 행도 언제든("" = 지움). 날짜가 지금과 같으면 날짜 변경이 아니다(메모만 반영, shiftFollowing 무시). 날짜는 앞 수업보다 뒤, 오늘 이후여야 하고, shiftFollowing이 아니면 뒤 수업보다 앞이어야 한다(아니면 400 scheduledDate). shiftFollowing이면 뒤 수업들을 새 날짜의 다음 수업일(수업 요일, 휴강 날짜 제외)부터 차례로 다시 놓는다. 지난 수업의 날짜 변경은 409 SESSION_PAST, 휴강 행의 날짜 변경은 400. 바꿀 값이 없으면 400. 회차 순서 바꾸기는 1차에 없다. 바뀐 뒤 진도표 전체(seq는 날짜 순으로 다시 매김 — 이 응답으로 다시 그린다). X-CSRF 필요
         */
        patch: operations["updateSession"];
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/sessions/{seq}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 휴강
         * @description 그 행은 날짜 그대로 cancelled로 남는다(메모 저장). shiftFollowing이면 같은 회차가 새 행으로 들어가고 뒤 수업들이 한 칸씩 다음 수업일로 밀린다(행 +1). false면 그 행만 휴강(그 회차는 건너뜀). note "" = 메모 없음. 이미 휴강한 행이면 아무것도 바꾸지 않고 200(메모도 — 메모는 4.6으로). 지난 수업은 409 SESSION_PAST(오늘 수업은 가능). 바뀐 뒤 진도표 전체(seq 다시 매김). X-CSRF 필요
         */
        post: operations["cancelSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/classes/{classId}/students/{studentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 학생 상세
         * @description 그 반에서 열린 회차(seq 순)별 지문 트랙(지문 → 목소리 순, 안 들은 트랙 포함)·회차 진도·단어 학습. 회차 진도가 없으면 not_started·0/지문 수(매트릭스와 같음). 학생은 그 반 현재 소속만 — 그 밖(다른 반·퇴원·다른 학원)은 404. 요청한 교사가 비활성화됐으면 401
         */
        get: operations["student"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher/students/{studentId}/personal-code/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 개인 코드 재발급
         * @description 교사는 담당 반에 지금 소속인 학생만, 관리자는 학원 안 어느 반이든 지금 소속인 학생 — 그 밖(다른 학원·담당 아님·퇴원·반 없음)은 404. 새 코드(숫자 4자리, 0으로 시작 가능) 평문은 이 응답에서만(다시 볼 수 없음). 옛 코드는 바로 무효, 그 학생의 refresh는 모두 끊긴다(남은 access는 최대 30분). 감사 로그. 요청한 교사가 비활성화됐으면 401. X-CSRF 필요
         */
        post: operations["regeneratePersonalCode"];
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
            season: "겨울" | "봄" | "여름" | "가을" | "새봄";
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
            type: "regular" | "module_review" | "integrated" | "supplement";
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
        ClassLevel: {
            /** @example L2 */
            code: string;
            /** @example #1F7A4F */
            colorHex: string;
            /** @example 그린 */
            nameKo: string;
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
            /** @description 레벨 표시 정보(인쇄 카드 레벨 칩 등) */
            level: components["schemas"]["ClassLevel"];
            /**
             * @deprecated
             * @description level.code와 같다. 새 코드는 level.code를 쓴다(2차에 지움)
             * @example L2
             */
            levelCode: string;
            name: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을" | "새봄";
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
        DashboardClass: {
            /**
             * Format: double
             * @description 오늘 회차를 완료한 학생 비율 0~1. current가 null이거나 학생이 0명이면 0
             */
            completedRate: number;
            /** @description 오늘 회차. 개강 전이면 null */
            current: components["schemas"]["DashboardCurrent"] | null;
            /** Format: int64 */
            id: number;
            name: string;
        };
        DashboardCurrent: {
            lesson: components["schemas"]["DashboardLesson"];
            /** Format: date */
            scheduledDate: string;
            /** Format: int32 */
            seq: number;
        };
        DashboardLesson: {
            /** @example L2-B1-05 */
            code: string;
            /** @example Reading Day 5 */
            title: string;
        };
        DashboardResponse: {
            /**
             * Format: int32
             * @description 오늘(학원 날짜) 한 번이라도 들은 학생 수
             */
            activeStudentsToday: number;
            /** @description 진행 중(active) 반 */
            classes: components["schemas"]["DashboardClass"][];
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
            type: "regular" | "module_review" | "integrated" | "supplement";
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
            title: string;
            /** @description 목소리별 지문 트랙(ADR-27). 학생이 골라 듣고, 아무 목소리 하나를 끝까지 들으면 그 지문 완료. 재생 속도는 플레이어가 조절 */
            voices: components["schemas"]["LessonDetailVoice"][];
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
        LessonDetailVoice: {
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
            /** @description 이 목소리로 끝까지 들으면 지문 완료로 치는가(완료 규칙 결과) */
            required: boolean;
            /** @description timings[i] = sentences[i]의 [시작, 끝] ms. 문장 시각이 아직 없으면 빈 배열 */
            timings: number[][];
            /** @description true면 근사 시각. 지금 콘텐츠는 목소리마다 정확한 시각이라 항상 false */
            timingsApproximate: boolean;
            /** Format: int64 */
            trackId: number;
            /**
             * @description 목소리: us_w 미국 여 · us_m 미국 남 · uk_w 영국 여 · uk_m 영국 남
             * @example us_w
             * @enum {string}
             */
            variant: "us_w" | "us_m" | "uk_w" | "uk_m";
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
        LessonWordsResponse: {
            items: components["schemas"]["WordItem"][];
            /**
             * Format: int32
             * @description 회차 단어 수(실제 35~106, 없으면 0)
             */
            total: number;
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
        LoginAlert: {
            /**
             * Format: int32
             * @description 최근 1시간 실패 수
             */
            failures: number;
            /**
             * Format: date-time
             * @description 세기 시작한 시각(UTC)
             */
            since: string;
        };
        MatrixCell: {
            /**
             * Format: date-time
             * @description 완료 시각(UTC), 미완료면 null
             */
            completedAt: string | null;
            /** @description 밀린 수업인가(ADR-24, 빨간 테두리) */
            overdue: boolean;
            /**
             * Format: int32
             * @description 완료한 필수 트랙 수
             */
            requiredDone: number;
            /**
             * Format: int32
             * @description 필수 트랙 수
             */
            requiredTotal: number;
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
        };
        MatrixClass: {
            /** Format: int64 */
            id: number;
            level: components["schemas"]["TeacherClassLevel"];
            name: string;
        };
        MatrixLesson: {
            /** @example L2-B1-05 */
            code: string;
            /**
             * Format: int32
             * @description 권 안 진도표 순서(블랙 1~28, 그 밖 1~24). 화면의 회차 번호는 code 끝
             */
            number: number;
            /** @example Reading Day 5 */
            title: string;
        };
        MatrixResponse: {
            /** @description 학생 id(문자열) → 회차 코드 → 칸. 열린 회차(opened)는 현재 학생마다 칸이 항상 있다(안 들었어도 not_started 칸 — 밀림 표시 overdue를 싣는다). 열리지 않은 회차는 칸이 없다(수업 전) */
            cells: {
                [key: string]: {
                    [key: string]: components["schemas"]["MatrixCell"];
                };
            };
            class: components["schemas"]["MatrixClass"];
            /** @description 요청 범위의 실제 수업(휴강 제외), seq 순 */
            sessions: components["schemas"]["MatrixSession"][];
            /** @description 현재 소속 학생(이름 순) */
            students: components["schemas"]["MatrixStudent"][];
        };
        MatrixSession: {
            /** @description 오늘 회차인가 */
            isCurrent: boolean;
            /** @description 열 머리글은 code 끝(07 → 7회, S1 → 보충 1). number는 정렬용 */
            lesson: components["schemas"]["MatrixLesson"];
            /** @description 회차가 열렸는가(학원 날짜·allowFutureLessons 포함 — 학생 화면과 같은 규칙). false면 '수업 전' */
            opened: boolean;
            /** Format: date */
            scheduledDate: string;
            /**
             * Format: int32
             * @description 진도표 행 번호(휴강 행도 번호를 차지한다)
             */
            seq: number;
            /** @enum {string} */
            status: "scheduled" | "done";
        };
        MatrixStudent: {
            grade: string | null;
            /** Format: int64 */
            id: number;
            name: string;
            school: string | null;
        };
        MeResponse: {
            academy: components["schemas"]["AcademyRef"];
            /** Format: int64 */
            id: number;
            name: string;
            /** @enum {string} */
            role: "student" | "teacher" | "admin" | "superadmin";
        };
        PersonalCodeItem: {
            /** Format: int64 */
            id: number;
            name: string;
            /**
             * @description 숫자 4자리(0으로 시작 가능)
             * @example 0482
             */
            personalCode: string;
        };
        PersonalCodeResponse: {
            name: string;
            /**
             * @description 숫자 4자리(0으로 시작 가능)
             * @example 0482
             */
            personalCode: string;
            /** Format: int64 */
            studentId: number;
        };
        PersonalCodesRegenerateRequest: {
            /** @description 그 반의 학생 id 1~50개 */
            studentIds: number[];
        };
        PersonalCodesResponse: {
            items: components["schemas"]["PersonalCodeItem"][];
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
        SessionCancelRequest: {
            /** @description 메모 100자 이하. 보내지 않으면 원래 메모 그대로, 빈 문자열이면 메모 없음 */
            note?: string;
            /** @description 뒤 수업을 밀지 여부 */
            shiftFollowing: boolean;
        };
        SessionItem: {
            lesson: components["schemas"]["TeacherLessonRef"];
            note: string | null;
            /** Format: date */
            scheduledDate: string;
            /**
             * Format: int32
             * @description 진도표 행 번호(휴강 행도 하나 차지 — 24를 넘을 수 있음)
             */
            seq: number;
            /** @enum {string} */
            status: "scheduled" | "done" | "cancelled";
        };
        SessionListResponse: {
            /** @description seq 순 */
            items: components["schemas"]["SessionItem"][];
        };
        SessionUpdateRequest: {
            /** @description 메모 100자 이하. 빈 문자열이면 지움 */
            note?: string;
            /**
             * Format: date
             * @description 새 수업일(학원 날짜). 지금 날짜와 같으면 날짜 변경 아님
             */
            scheduledDate?: string;
            /** @description true면 뒤 수업들을 새 날짜의 다음 수업일(수업 요일, 휴강 날짜 제외)부터 차례로 다시 놓는다. 날짜 변경이 없으면 무시. 기본 false */
            shiftFollowing?: boolean;
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
            user: components["schemas"]["StaffUserInfo"];
        };
        StaffUserInfo: {
            /** Format: int64 */
            academyId: number;
            /** Format: int64 */
            id: number;
            name: string;
            /** @enum {string} */
            role: "teacher" | "admin";
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
            season: "겨울" | "봄" | "여름" | "가을" | "새봄";
        };
        StudentClassInfo: {
            book: components["schemas"]["StudentClassBook"];
            /** Format: int64 */
            id: number;
            level: components["schemas"]["StudentClassLevel"];
            /**
             * @description 그 반 권의 사용 상태(ADR 0031). before_start = 사용 시작 전, expired = 사용 기간이 끝났거나 사용권 없음. active가 아니면 그 반 회차를 열 때 403 LICENSE_INACTIVE. 사용권을 적용하지 않는 학원은 항상 active
             * @enum {string}
             */
            licenseStatus: "before_start" | "active" | "expired";
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
        StudentCreateItem: {
            /** @description 10자 이하(예: 중1) */
            grade?: string;
            /** @description 1~30자 */
            name: string;
            /** @description 50자 이하 */
            school?: string;
        };
        StudentCreateRequest: {
            /** @description 1~50명 */
            students: components["schemas"]["StudentCreateItem"][];
        };
        StudentCreatedResponse: {
            created: components["schemas"]["PersonalCodeItem"][];
        };
        StudentDetailLesson: {
            /** @example L2-B1-05 */
            code: string;
            /** Format: int32 */
            requiredDone: number;
            /** Format: int32 */
            requiredTotal: number;
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
            /** @example Reading Day 5 */
            title: string;
            /** @description 지문 트랙(목소리별) */
            tracks: components["schemas"]["StudentDetailTrack"][];
            words: components["schemas"]["StudentDetailWords"];
        };
        StudentDetailResponse: {
            /** @description 그 반에서 열린 회차(seq 오름차순) */
            lessons: components["schemas"]["StudentDetailLesson"][];
            student: components["schemas"]["StudentDetailStudent"];
        };
        StudentDetailStudent: {
            grade: string | null;
            /** Format: int64 */
            id: number;
            /**
             * Format: date-time
             * @description 마지막 로그인(UTC), 없으면 null
             */
            lastLoginAt: string | null;
            name: string;
            school: string | null;
        };
        StudentDetailTrack: {
            completed: boolean;
            /**
             * Format: double
             * @description 들은 비율 0~1
             */
            coverage: number;
            /**
             * Format: int32
             * @description 트랙 길이 ms
             */
            durationMs: number;
            /** @enum {string} */
            kind: "passage";
            /**
             * Format: date-time
             * @description 마지막 재생(UTC), 안 들었으면 null
             */
            lastPlayedAt: string | null;
            /**
             * Format: int32
             * @description 지문 번호 1~6
             */
            passageNo: number;
            /** @description 회차 완료에 필요한 트랙인가 */
            required: boolean;
            /** Format: int32 */
            sessionCount: number;
            /**
             * Format: int64
             * @description 반복 포함 총 재생 ms
             */
            totalPlayMs: number;
            /**
             * @description 목소리: us_w 미국 여 · us_m 미국 남 · uk_w 영국 여 · uk_m 영국 남
             * @example us_w
             * @enum {string}
             */
            variant: "us_w" | "us_m" | "uk_w" | "uk_m";
        };
        StudentDetailWords: {
            /**
             * Format: int32
             * @description 카드 본 수(누적 최고). 기록 없으면 0
             */
            cardsViewed: number;
            /** Format: int32 */
            memKnown: number;
            /** Format: int32 */
            recallBest: number;
            /** Format: int32 */
            spellBest: number;
            /**
             * Format: int32
             * @description 회차 단어 수(어휘책 + 추가 어휘). 없으면 0
             */
            total: number;
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
            type: "regular" | "module_review" | "integrated" | "supplement";
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
        StudentListResponse: {
            items: components["schemas"]["StudentResponse"][];
            /** Format: int32 */
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
        StudentMoveRequest: {
            /**
             * Format: int64
             * @description 같은 학원의 반
             */
            toClassId: number;
        };
        StudentResponse: {
            /**
             * Format: date-time
             * @description 개인 코드 발급 시각(UTC). 코드가 없으면 null
             */
            codeIssuedAt: string | null;
            grade: string | null;
            /** Format: int64 */
            id: number;
            /**
             * Format: date-time
             * @description 마지막 로그인(UTC). 한 번도 없으면 null
             */
            lastLoginAt: string | null;
            name: string;
            school: string | null;
            /**
             * @description inactive = 퇴원(기록은 남음)
             * @enum {string}
             */
            status: "active" | "inactive";
        };
        StudentSearchClass: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        StudentSearchItem: {
            /** @description 지금 반. 없으면(퇴원) null */
            class: components["schemas"]["StudentSearchClass"] | null;
            grade: string | null;
            /** Format: int64 */
            id: number;
            name: string;
            school: string | null;
            /** @enum {string} */
            status: "active" | "inactive";
        };
        StudentSearchRequest: {
            /** @description 이름 일부, 1~30자 */
            name: string;
        };
        StudentSearchResponse: {
            items: components["schemas"]["StudentSearchItem"][];
        };
        StudentUpdateRequest: {
            /** @description 10자 이하. 빈 문자열이면 지움 */
            grade?: string;
            /** @description 1~30자 */
            name?: string;
            /** @description 50자 이하. 빈 문자열이면 지움 */
            school?: string;
            /**
             * @description inactive = 퇴원(기록 보존, 로그인 불가)
             * @enum {string}
             */
            status?: "active" | "inactive";
        };
        TeacherClassBook: {
            /** @example L2-B1 */
            code: string;
            /** @example Book 1 */
            label: string;
            /** @enum {string} */
            season: "겨울" | "봄" | "여름" | "가을" | "새봄";
        };
        TeacherClassCurrent: {
            /**
             * Format: int32
             * @description 오늘 회차 완료 학생 수
             */
            completed: number;
            /**
             * Format: int32
             * @description 진행 중 학생 수
             */
            inProgress: number;
            lesson: components["schemas"]["TeacherLessonRef"];
            /**
             * Format: int32
             * @description 시작 안 한 학생 수
             */
            notStarted: number;
            /** Format: date */
            scheduledDate: string;
            /**
             * Format: int32
             * @description 진도표 행 번호
             */
            seq: number;
        };
        TeacherClassItem: {
            book: components["schemas"]["TeacherClassBook"];
            /** @description 오늘 회차. 개강 전이면 null */
            current: components["schemas"]["TeacherClassCurrent"] | null;
            /** Format: int64 */
            id: number;
            level: components["schemas"]["TeacherClassLevel"];
            /** @description 반 전체 개인 코드 실패가 1시간 20회를 넘으면, 아니면 null */
            loginAlert: components["schemas"]["LoginAlert"] | null;
            name: string;
            /** @description 다음 수업. 진도표가 끝났으면 null */
            next: components["schemas"]["TeacherClassNext"] | null;
            /**
             * Format: int32
             * @description 밀린 수업이 하나라도 있는 학생 수(ADR-24)
             */
            overdueStudents: number;
            /**
             * Format: int32
             * @description 현재 소속 학생 수
             */
            studentCount: number;
        };
        TeacherClassLevel: {
            /** @example L2 */
            code: string;
            /** @example #1F7A4F */
            colorHex: string;
            /** @example 그린 */
            nameKo: string;
        };
        TeacherClassListResponse: {
            items: components["schemas"]["TeacherClassItem"][];
        };
        TeacherClassNext: {
            /** Format: date */
            scheduledDate: string;
            /** Format: int32 */
            seq: number;
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
        TeacherLessonDetailResponse: {
            lesson: components["schemas"]["TeacherLessonInfo"];
            /** @description 현재 소속 학생(이름 순) */
            rows: components["schemas"]["TeacherLessonRow"][];
            /** @description 지문 트랙(목소리별, required로 구분) */
            tracks: components["schemas"]["TeacherLessonTrack"][];
        };
        TeacherLessonInfo: {
            /** @example L2-B1-05 */
            code: string;
            /**
             * Format: date
             * @description 그 반 진도표의 수업일. 휴강만 있으면 null
             */
            scheduledDate: string | null;
            /** @example Reading Day 5 */
            title: string;
        };
        TeacherLessonRef: {
            /** @example L2-B1-05 */
            code: string;
            /** @example Reading Day 5 */
            title: string;
        };
        TeacherLessonRow: {
            /** @description 트랙 id(문자열) → 결과. 없으면 안 들음 */
            byTrack: {
                [key: string]: components["schemas"]["TeacherLessonTrackResult"];
            };
            /** @enum {string} */
            status: "not_started" | "in_progress" | "completed";
            student: components["schemas"]["TeacherLessonStudent"];
        };
        TeacherLessonStudent: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        TeacherLessonTrack: {
            /** @enum {string} */
            kind: "passage";
            /** Format: int32 */
            passageNo: number;
            required: boolean;
            /** Format: int64 */
            trackId: number;
            /**
             * @description 목소리: us_w 미국 여 · us_m 미국 남 · uk_w 영국 여 · uk_m 영국 남
             * @example us_w
             * @enum {string}
             */
            variant: "us_w" | "us_m" | "uk_w" | "uk_m";
        };
        TeacherLessonTrackResult: {
            completed: boolean;
            /**
             * Format: double
             * @description 들은 비율 0~1
             */
            coverage: number;
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
        WordAudio: {
            /** @description 같은 도메인 상대 경로 */
            audioUrl: string;
            /**
             * Format: int32
             * @description 길이 ms
             */
            durationMs: number;
            /** Format: int64 */
            trackId: number;
        };
        WordItem: {
            /** @description 단어 발음. 음원이 아직 없으면 null */
            audio: components["schemas"]["WordAudio"] | null;
            /** @example sudden */
            english: string;
            /** @description 예문(지문 문장이 아님, ADR-25) */
            example: string;
            /** @description 예문 음원. 없으면 null */
            exampleAudio: components["schemas"]["WordAudio"] | null;
            /** @description 예문 해석. 없으면 null(지금 자료에서는 어휘책에만 있는 단어 — source와 따로 판단) */
            exampleKo: string | null;
            /** Format: int64 */
            id: number;
            /** @example 갑작스러운 */
            korean: string;
            /**
             * Format: int32
             * @description 회차 안 교재 순서(1부터)
             */
            order: number;
            /**
             * @description 품사. 화면 표기(명사·동사·대명사·감탄사…)는 프론트
             * @enum {string}
             */
            pos: "n" | "v" | "adj" | "adv" | "prep" | "conj" | "pron" | "interj" | "phr";
            /**
             * @description 출처(ADR 0029): book 어휘책 그 강의 단어·숙어, extra 어휘책에 없는 회차 어휘. 목록 탭 필터용. 음원 유무와는 따로(어휘책 음원이 들어오면 book도 음원이 있다)
             * @enum {string}
             */
            source: "book" | "extra";
        };
        WordStudyRequest: {
            /**
             * Format: int32
             * @description 본 카드 수
             */
            cardsViewed?: number;
            /**
             * Format: int32
             * @description 암기 모드 '알아요' 수
             */
            memKnown?: number;
            /**
             * Format: int32
             * @description 리콜 모드 맞힌 수(최고 기록으로 저장)
             */
            recallCorrect?: number;
            /**
             * Format: int32
             * @description 스펠 모드 맞힌 수(최고 기록으로 저장)
             */
            spellCorrect?: number;
        };
        WordStudyResponse: {
            /** @description 회차 단어를 모두 봤는가 */
            allViewed: boolean;
            /** Format: int32 */
            cardsViewed: number;
            /** Format: int32 */
            memKnown: number;
            /** Format: int32 */
            recallBest: number;
            /** Format: int32 */
            spellBest: number;
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
    update_2: {
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
    list_2: {
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
                    "*/*": components["schemas"]["StudentListResponse"];
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
    create_2: {
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
                "application/json": components["schemas"]["StudentCreateRequest"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StudentCreatedResponse"];
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
    regeneratePersonalCodes: {
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
                "application/json": components["schemas"]["PersonalCodesRegenerateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["PersonalCodesResponse"];
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
    dashboard: {
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
                    "*/*": components["schemas"]["DashboardResponse"];
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
    search: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudentSearchRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StudentSearchResponse"];
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
                "application/json": components["schemas"]["StudentUpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StudentResponse"];
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
    move: {
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
                "application/json": components["schemas"]["StudentMoveRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["StudentResponse"];
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
    saveStudy: {
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
        requestBody: {
            content: {
                "application/json": components["schemas"]["WordStudyRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["WordStudyResponse"];
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
    words: {
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
                    "*/*": components["schemas"]["LessonWordsResponse"];
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
    classes: {
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
                    "*/*": components["schemas"]["TeacherClassListResponse"];
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
    lesson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                classId: number;
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
                    "*/*": components["schemas"]["TeacherLessonDetailResponse"];
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
    matrix: {
        parameters: {
            query?: {
                /** @description 시작 seq(포함) 1~99 */
                fromSeq?: number;
                /** @description 끝 seq(포함) 1~99 */
                toSeq?: number;
            };
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
                    "*/*": components["schemas"]["MatrixResponse"];
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
    sessions: {
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
                    "*/*": components["schemas"]["SessionListResponse"];
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
    updateSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                classId: number;
                /** @description 진도표 행 번호 1~99(방금 받은 진도표의 seq) */
                seq: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionUpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["SessionListResponse"];
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
    cancelSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                classId: number;
                /** @description 진도표 행 번호 1~99(방금 받은 진도표의 seq) */
                seq: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionCancelRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["SessionListResponse"];
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
    student: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                classId: number;
                studentId: number;
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
                    "*/*": components["schemas"]["StudentDetailResponse"];
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
    regeneratePersonalCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                studentId: number;
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
                    "*/*": components["schemas"]["PersonalCodeResponse"];
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
