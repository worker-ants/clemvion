"""Role-specific prompt bodies shared by both orchestrators.

The sub-agent's system prompt (`.claude/agents/<name>.md`) already describes
the role, but the orchestrator-produced prompt body must *also* be
role-specific. Two reasons:
  1. Role isolation. Each `_prompts/<agent>.md` ends up genuinely different —
     not "13 copies of the same payload routed to 13 agent types". If the
     reviewer's perspective ever drifts (e.g. Claude Code merges prompts
     differently in the future), the request itself still carries the role.
  2. Reinforcement. Repeating perspective + checklist inside the user-message
     improves how the sub-agent stays on-topic across long contexts.

The reviewer / checker dicts below carry, per role:
  - `ko_title`     — human-readable Korean title (matches existing docs)
  - `perspective`  — one-sentence "what you're being asked to look at"
  - `checklist`    — raw markdown bullet list of role-specific items
  - (reviewer only) `scope_optional`
        True for roles that legitimately say "해당 없음" (database,
        concurrency, api_contract). The orchestrator adds a one-line note
        permitting that outcome only when this flag is set.
  - (checker only) `context_label` / `context_key`
        Which subs key feeds the role's supplementary corpus (related_specs,
        rationale_excerpts, conventions, plan_in_progress, or combined).
"""


REVIEWER_INSTRUCTIONS = {
    "security": {
        "ko_title": "보안(Security)",
        "perspective": "다음 코드 변경을 보안 관점에서 분석한다.",
        "checklist": """1. **인젝션 취약점**: SQL 인젝션, XSS, 커맨드 인젝션, LDAP 인젝션, 경로 탐색 등
2. **하드코딩된 시크릿**: API 키, 비밀번호, 토큰, 인증서 등이 코드에 직접 포함되어 있는지
3. **인증/인가**: 인증 우회 가능성, 권한 검증 누락, 세션 관리 문제
4. **입력 검증**: 사용자 입력의 적절한 검증 및 새니타이징 여부
5. **OWASP Top 10**: 위 항목 외 OWASP Top 10 해당 취약점
6. **암호화**: 안전하지 않은 해시/암호화 알고리즘, 평문 전송
7. **에러 처리**: 민감 정보가 에러 메시지에 노출되는지
8. **의존성 보안**: 알려진 취약점이 있는 라이브러리 사용 여부""",
        "scope_optional": False,
    },
    "performance": {
        "ko_title": "성능(Performance)",
        "perspective": "다음 코드 변경을 성능 관점에서 분석한다.",
        "checklist": """1. **알고리즘 복잡도**: 시간/공간 복잡도, 비효율적인 알고리즘
2. **N+1 쿼리/호출**: 반복문 내 DB·API 호출, 배치 처리 가능 여부
3. **메모리 할당**: 불필요한 객체 생성, 대규모 데이터 적재, 메모리 누수 가능성
4. **캐싱**: 반복 계산/호출 결과 캐싱 필요성, 캐시 무효화 전략
5. **블로킹 I/O**: 동기 I/O 병목, 비동기 처리가 필요한 구간
6. **불필요한 연산**: 중복 계산, 과도한 문자열 연결 (O(n²) 누적 등)
7. **데이터 구조**: 용도에 맞지 않는 자료구조 사용
8. **지연 로딩**: 즉시 필요하지 않은 리소스의 선행 로딩""",
        "scope_optional": False,
    },
    "architecture": {
        "ko_title": "아키텍처(Architecture)",
        "perspective": "다음 코드 변경을 아키텍처 관점에서 분석한다.",
        "checklist": """1. **SOLID 원칙**: 단일 책임, 개방-폐쇄, 리스코프 치환, 인터페이스 분리, 의존성 역전
2. **결합도/응집도**: 모듈 간 결합도가 낮고 응집도가 높은지
3. **레이어 책임**: 프레젠테이션/비즈니스/데이터 레이어 책임 분리
4. **디자인 패턴**: 적절한 패턴 사용 여부, 안티패턴 존재 여부
5. **순환 의존성**: 모듈/패키지 간 순환 참조 여부
6. **추상화 수준**: 적절한 추상화 레벨, 과도하거나 부족한 추상화
7. **모듈 경계**: 모듈/서비스 간 경계가 명확한지
8. **확장성**: 향후 기능 확장에 유연한 구조인지""",
        "scope_optional": False,
    },
    "requirement": {
        "ko_title": "요구사항(Requirement)",
        "perspective": "다음 코드 변경이 의도한 기능을 충족하는지 분석한다.",
        "checklist": """1. **기능 완전성**: 코드가 의도한 기능을 완전히 구현하고 있는지
2. **엣지 케이스**: 경계값, null/undefined, 빈 컬렉션, 최대/최솟값 처리
3. **TODO/FIXME**: 미완성 작업을 시사하는 TODO, FIXME, HACK, XXX 주석 존재 여부
4. **의도와 구현 간 괴리**: 함수명·주석과 실제 구현의 일치
5. **에러 시나리오**: 정상 흐름 외 에러 상황 동작 정의
6. **데이터 유효성**: 입력 데이터의 유효성 검증
7. **비즈니스 로직**: 비즈니스 규칙이 코드에 정확히 반영됐는지
8. **반환값**: 모든 경로에서 적절한 값을 반환하는지""",
        "scope_optional": False,
    },
    "scope": {
        "ko_title": "변경 범위(Scope)",
        "perspective": "다음 코드 변경이 의도된 범위를 벗어나지 않는지 분석한다.",
        "checklist": """1. **의도 이상의 변경**: 요청된 변경 외 추가 수정이 포함됐는지
2. **불필요한 리팩토링**: 현재 작업과 관련 없는 코드 정리·리팩토링
3. **기능 확장**: 요청하지 않은 기능 추가 (over-engineering)
4. **무관한 수정**: 변경 의도와 관련 없는 파일·코드 영역 수정
5. **포맷팅 변경**: 의미 없는 공백·줄바꿈·포맷팅이 실질 변경과 섞여 있는지
6. **주석 변경**: 불필요한 주석 추가/삭제/수정
7. **임포트 변경**: 사용하지 않는 임포트 추가나 불필요한 정리
8. **설정 변경**: 의도하지 않은 설정 파일 변경""",
        "scope_optional": False,
    },
    "side_effect": {
        "ko_title": "부작용(Side Effect)",
        "perspective": "다음 코드 변경이 의도하지 않은 부작용을 일으키지 않는지 분석한다.",
        "checklist": """1. **의도치 않은 상태 변경**: 함수가 예상 외의 전역/공유 상태를 변경하는지
2. **전역 변수**: 전역 변수 수정 또는 새 전역 변수 도입
3. **파일시스템 부작용**: 예상치 못한 파일 생성·수정·삭제
4. **시그니처 변경**: 기존 함수/메서드 시그니처 변경의 호출자 영향
5. **인터페이스 변경**: 공개 API 변경이 기존 사용자에 미치는 영향
6. **환경 변수**: 환경 변수의 예상치 못한 읽기/쓰기
7. **네트워크 호출**: 의도하지 않은 외부 서비스 호출
8. **이벤트/콜백**: 이벤트 발생·콜백 호출의 변경""",
        "scope_optional": False,
    },
    "maintainability": {
        "ko_title": "유지보수성(Maintainability)",
        "perspective": "다음 코드 변경을 유지보수성 관점에서 분석한다.",
        "checklist": """1. **가독성**: 코드가 읽기 쉽고 의도가 명확한지
2. **네이밍**: 변수/함수/클래스 이름이 목적을 잘 나타내는지, 컨벤션 일관성
3. **함수 길이**: 함수가 너무 길거나 여러 책임을 가지고 있는지
4. **중첩 깊이**: 조건문·반복문 중첩 과도 여부
5. **매직 넘버**: 의미를 알 수 없는 하드코딩된 숫자·문자열
6. **중복 코드**: 동일하거나 유사한 코드가 반복되는지
7. **코드 복잡도**: 순환 복잡도가 높지 않은지
8. **일관성**: 기존 코드베이스 스타일·패턴 준수""",
        "scope_optional": False,
    },
    "testing": {
        "ko_title": "테스트(Testing)",
        "perspective": "다음 코드 변경을 테스트 관점에서 분석한다.",
        "checklist": """1. **테스트 존재 여부**: 변경 코드에 대한 테스트 존재·추가 필요성
2. **커버리지 갭**: 테스트로 커버되지 않는 코드 경로
3. **엣지 케이스 테스트**: 경계값·예외 상황·null 처리 테스트 필요 여부
4. **Mock 적절성**: mock/stub 사용 적절성, 실제 동작과의 괴리
5. **테스트 격리**: 테스트 간 의존성 없이 독립 실행 가능한지
6. **테스트 가독성**: 테스트 코드가 명확하고 의도를 잘 표현
7. **회귀 테스트**: 기존 테스트가 변경 후에도 유효한지
8. **테스트 용이성**: 코드가 테스트하기 쉬운 구조인지 (의존성 주입 등)""",
        "scope_optional": False,
    },
    "documentation": {
        "ko_title": "문서화(Documentation)",
        "perspective": "다음 코드 변경을 문서화 관점에서 분석한다.",
        "checklist": """1. **독스트링/JSDoc**: 공개 함수·클래스·모듈에 적절한 문서가 있는지
2. **README 업데이트**: 새 기능·설정이 추가된 경우 README 업데이트 필요성
3. **API 문서**: API 엔드포인트 변경 시 문서 업데이트 필요성
4. **주석 정확성**: 기존 주석이 변경된 코드와 일치하는지 (오래된 주석)
5. **인라인 주석**: 복잡한 로직에 적절한 설명
6. **변경 이력**: 중요한 변경에 대한 CHANGELOG 업데이트 필요성
7. **설정 문서**: 새 환경변수·설정 옵션 문서화
8. **예제 코드**: 사용법을 보여주는 예제 필요성""",
        "scope_optional": False,
    },
    "dependency": {
        "ko_title": "의존성(Dependency)",
        "perspective": "다음 코드 변경을 의존성 관점에서 분석한다.",
        "checklist": """1. **새 의존성**: 새 외부 패키지/라이브러리 추가 여부와 필요성
2. **버전 고정**: 의존성 버전 고정(pinning) 여부
3. **라이선스**: 새 의존성의 라이선스가 프로젝트와 호환되는지
4. **취약점**: 알려진 보안 취약점이 있는 의존성 사용 여부
5. **불필요한 의존성**: 표준 라이브러리·기존 의존성으로 대체 가능한지
6. **의존성 크기**: 번들 크기·빌드 시간 영향
7. **호환성**: 기존 의존성과의 버전 충돌·호환성
8. **내부 의존성**: 프로젝트 내부 모듈 간 의존 관계""",
        "scope_optional": False,
    },
    "database": {
        "ko_title": "데이터베이스(Database)",
        "perspective": "다음 코드 변경을 데이터베이스 관점에서 분석한다.",
        "checklist": """1. **인덱스**: 쿼리에 적절한 인덱스 사용·누락 가능성
2. **N+1 쿼리**: 반복문 내 개별 쿼리 실행 N+1 문제
3. **트랜잭션**: 데이터 정합성을 위한 트랜잭션 사용 적절성
4. **마이그레이션 안전성**: 스키마 변경이 무중단 배포에 안전한지 (lock, 데이터 손실)
5. **스키마 설계**: 테이블 구조·관계·정규화/비정규화 적절성
6. **커넥션 관리**: 커넥션 풀 사용·적절한 해제
7. **SQL 인젝션** (DB 특화 관점): 파라미터화된 쿼리 사용 여부
8. **대량 데이터**: 대용량 테이블에서의 쿼리 성능·페이지네이션""",
        "scope_optional": True,
    },
    "concurrency": {
        "ko_title": "동시성(Concurrency)",
        "perspective": "다음 코드 변경을 동시성/병렬 처리 관점에서 분석한다.",
        "checklist": """1. **경쟁 조건(Race Condition)**: 공유 자원 동시 접근으로 인한 경쟁 조건
2. **데드락**: 여러 락 사용 시 데드락 가능성
3. **동기화**: 공유 자원에 대한 적절한 동기화 (mutex/semaphore/lock)
4. **스레드 안전성**: 변수·컬렉션·객체의 스레드 세이프 여부
5. **async/await**: 비동기 코드의 올바른 사용, await 누락
6. **원자성**: 복합 연산의 원자성 보장
7. **이벤트 루프**: 이벤트 루프 블로킹·콜백 지옥·Promise 체인 관리
8. **리소스 풀링**: 스레드 풀·커넥션 풀의 크기·관리""",
        "scope_optional": True,
    },
    "api_contract": {
        "ko_title": "API 계약(API Contract)",
        "perspective": "다음 코드 변경을 API 계약 관점에서 분석한다.",
        "checklist": """1. **하위 호환성**: 기존 API 클라이언트 영향, breaking change 여부
2. **버전 관리**: API 버전이 적절히 관리되는지
3. **응답 형식**: API 응답 구조의 일관성·스키마 준수
4. **에러 응답**: 에러 응답 형식 일관성·HTTP 상태 코드 적절성
5. **요청 검증**: 요청 매개변수·바디 유효성 검증 충분성
6. **URL/경로 설계**: RESTful 원칙·일관된 네이밍
7. **페이지네이션**: 목록 API 의 페이지네이션 적절성
8. **인증/인가**: 엔드포인트의 인증/인가 적용""",
        "scope_optional": True,
    },
}


CHECKER_INSTRUCTIONS = {
    "cross_spec": {
        "ko_title": "Cross-Spec 일관성",
        "perspective": "target 문서(draft)가 기존 `spec/**` 의 다른 영역과 충돌하는지 분석한다.",
        "checklist": """1. **데이터 모델 충돌** — target 이 정의하는 엔티티·필드가 다른 영역의 동일 엔티티 정의와 모순되는가
2. **API 계약 충돌** — endpoint·HTTP method·request/response shape 이 다른 spec 의 정의와 어긋나는가
3. **요구사항 ID 충돌** — 요구사항 ID(예: `NAV-*`, `ED-AI-*`)가 다른 영역에서 다른 의미로 이미 사용 중인가
4. **상태 전이 충돌** — 같은 도메인 엔티티의 상태 머신이 영역마다 다르게 기술되어 있는가
5. **권한·RBAC 모델 충돌** — 새 권한 구조가 기존 RBAC 규칙과 어긋나는가
6. **계층 책임 충돌** — frontend/backend 경계·노드 카테고리 간 책임 분할이 기존 결정과 일치하는가""",
        "context_label": "관련 spec 본문 (다른 영역 포함)",
        "context_key": "related_specs",
    },
    "rationale_continuity": {
        "ko_title": "Rationale 연속성",
        "perspective": "target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.",
        "checklist": """1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가""",
        "context_label": "관련 Rationale 발췌",
        "context_key": "rationale_excerpts",
    },
    "convention_compliance": {
        "ko_title": "정식 규약 준수",
        "perspective": "target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.",
        "checklist": """1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가""",
        "context_label": "정식 규약 모음 (spec/conventions/)",
        "context_key": "conventions",
    },
    "plan_coherence": {
        "ko_title": "Plan 정합성",
        "perspective": "`plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.",
        "checklist": """1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)""",
        "context_label": "진행 중 plan 문서 모음 (plan/in-progress/)",
        "context_key": "plan_in_progress",
    },
    "naming_collision": {
        "ko_title": "신규 식별자 충돌",
        "perspective": "target 문서가 도입하는 새 식별자가 기존 사용처와 충돌하지 않는지 분석한다.",
        "checklist": """1. **요구사항 ID 충돌** — target 이 새로 부여하는 ID 가 기존에 다른 의미로 이미 사용되고 있는가
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 명이 기존 영역에서 다른 의미로 사용 중인가
3. **API endpoint 충돌** — 새 endpoint(method + path)가 기존 spec 에 이미 정의되어 있는가
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 이름 충돌
5. **환경변수·설정키 충돌** — 새 ENV var, config key 가 기존 사용처와 겹치는가
6. **파일 경로 충돌** — 새 spec 파일 경로/이름이 기존 명명 컨벤션을 깨거나 기존 파일과 겹치는가""",
        "context_label": "검색 대상 코퍼스 (spec/, plan/in-progress/, conventions/)",
        # `naming_collision` consumes three sub-corpora; the orchestrator
        # concatenates them when it sees this sentinel value.
        "context_key": "__combined_naming_corpus__",
    },
}
