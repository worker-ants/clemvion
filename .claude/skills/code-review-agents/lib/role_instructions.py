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
3. **요구사항 ID 충돌** — target 이 새로 부여하는 요구사항 ID 가 다른 영역에서 다른 의미로 이미 사용 중인가
4. **상태 전이 충돌** — 같은 도메인 엔티티의 상태 머신이 영역마다 다르게 기술되어 있는가
5. **권한·RBAC 모델 충돌** — 새 권한 구조가 기존 RBAC 규칙과 어긋나는가
6. **계층 책임 충돌** — 코드베이스 영역(예: 서버/클라이언트, 도메인 모듈) 간 책임 분할이 기존 결정과 일치하는가""",
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
2. **출력 포맷 규약** — API 응답·이벤트 페이로드·에러 코드 등 출력 형식이 `spec/conventions/` 의 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — API 문서 도구(OpenAPI/Swagger 등)의 데코레이터·DTO 명명 패턴 준수
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴을 답습하고 있지 않은가""",
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


# Merge-coordinator analyzers + summary + resolver. Used by
# `merge_coordinator_orchestrator.py` to build role-specific prompt bodies
# and by `.claude/agents/<name>.md` definitions (which embed the same
# perspective and checklist via the regenerator script).
ANALYZER_INSTRUCTIONS = {
    "merge_conflict_analyzer": {
        "ko_title": "Text-level 충돌 분석",
        "perspective": "다수 branch 를 통합할 때 발생할 git hunk-level conflict 를 예측하고 자동 해결 난이도를 평가한다.",
        "checklist": """1. **같은 파일·같은 hunk** — 두 branch 이상이 동일 파일의 겹치는 hunk 를 수정하는가
2. **자동 해결 가능 패턴** — import 정렬, 단순 추가, 동일 의미 리네임 등 mechanical merge 가 가능한지
3. **수동 개입 필요 패턴** — 같은 함수 본문의 의미가 다른 두 방향으로 수정된 경우
4. **rename/move 충돌** — 한 branch 가 파일을 옮겼는데 다른 branch 가 같은 파일을 수정한 경우
5. **삭제·재추가 충돌** — 한쪽이 삭제, 다른 쪽이 수정한 경우
6. **공백·EOL·인코딩 충돌** — 의미는 같지만 mechanical 충돌이 생기는 경우
7. **하위 conflict 수** — 통합 1회당 예상 conflict hunk 수 + 영향 파일 수
8. **권장 통합 순서 힌트** — 어느 branch 를 먼저 합치면 충돌이 줄어드는지 (integration-order-planner 의 input 으로)""",
    },
    "semantic_conflict_analyzer": {
        "ko_title": "의미 충돌 분석",
        "perspective": "통합 대상 branch 들이 서로의 가정·인터페이스·동작을 깨고 있지 않은지 의미 수준에서 분석한다.",
        "checklist": """1. **signature 변경 cross-impact** — branch A 가 함수 시그니처를 바꿨고, branch B 가 그 함수의 옛 시그니처를 호출하는가
2. **behavior drift** — 같은 함수·엔드포인트의 동작이 두 branch 에서 서로 다른 방향으로 진화했는가
3. **공유 모듈 invariant 위반** — branch 가 공유 모듈의 가정 (예: 락 순서, 호출 순서, 에러 처리 규약) 을 깨는가
4. **데이터 모델 cross-conflict** — 같은 엔티티/타입을 두 branch 가 호환되지 않게 확장했는가
5. **공유 상수·환경변수 충돌** — 같은 ENV/config key 의 의미가 두 branch 에서 다른가
6. **외부 호출 규약 충돌** — webhook 페이로드·SSE 이벤트·queue 메시지 schema 가 충돌하는가
7. **테스트 가정 충돌** — 한 branch 의 테스트가 다른 branch 의 변경으로 거짓 통과/실패하게 되는가
8. **의존성 버전 충돌** — package.json·lockfile 의 동일 의존성을 두 branch 가 다른 버전으로 고정했는가""",
    },
    "integration_order_planner": {
        "ko_title": "통합 순서·base 결정",
        "perspective": "통합 대상 branch 들의 의존성 그래프를 만들고 base branch 와 통합 순서를 동적으로 결정한다.",
        "checklist": """1. **의존성 추출** — 각 branch 가 다른 branch 의 commit 을 전제로 하거나 PR depends-on 표기가 있는가
2. **base 결정** — main 또는 가장 안정적인 branch 를 base 로. 사용자 힌트(`MERGE_BASE_HINT`) 가 있으면 우선 검토
3. **topological 순서** — 의존성 그래프의 위상 정렬로 통합 순서 산출
4. **충돌 최소 경로** — merge-conflict-analyzer 의 hunk 충돌 정보를 보고 충돌이 적게 발생하는 순서 선택
5. **cherry-pick 분리 권고** — 한 branch 가 너무 큰 conflict 를 유발하면 일부 commit 만 분리 권고
6. **rebase vs merge 권고** — branch 별로 적절한 통합 방식
7. **실패 시 롤백 포인트** — 통합 중 실패 시 되돌아갈 commit
8. **불가 통합 식별** — 통합이 위험해 추천 안 하는 branch (사용자 직접 해결 필요)""",
    },
    "cross_branch_spec_analyzer": {
        "ko_title": "Branch 간 spec/plan 충돌",
        "perspective": "통합 대상 branch 들이 spec/, plan/in-progress/ 영역을 어떻게 변경했는지 비교해 cross-branch 충돌을 검출한다. 기존 cross-spec-checker 는 단일 draft vs 기존 spec 이고, 본 analyzer 는 multi-draft 간 충돌이 대상.",
        "checklist": """1. **같은 spec 파일 다른 변경** — 두 branch 이상이 동일 `spec/<영역>/*.md` 를 서로 다른 방향으로 수정
2. **같은 plan 영역 동시 진행** — frontmatter 의 `worktree` 가 다른 두 plan 이 동일 spec 파일을 손대고 있는지
3. **요구사항 ID cross-branch 중복** — branch 마다 다른 의미로 같은 요구사항 ID prefix 를 도입했는가
4. **API 계약의 cross-branch divergence** — 같은 endpoint 를 branch 마다 다르게 정의
5. **Rationale 충돌** — 한 branch 가 추가한 Rationale 결정을 다른 branch 가 무시·번복하고 있는지
6. **convention 위반의 cross-branch 누적** — 한 branch 의 convention 변경이 다른 branch 의 코드와 어긋남
7. **plan/in-progress 의 중복 worktree** — `plan_coherence` 의 multi-draft 버전: 같은 영역을 두 plan 이 동시에 점유
8. **통합 후 plan/spec 의 최종 상태 예측** — 단순 머지로 정합 가능한지, 별도 합의가 필요한지""",
    },
    "integration_risk_summary": {
        "ko_title": "통합 위험 통합 보고서",
        "perspective": "위 4 analyzer 결과를 통합해 BLOCK 결정과 통합 plan 표를 작성한다.",
        "checklist": """1. **중복 제거** — 여러 analyzer 가 동일 위험을 다른 각도로 지적한 경우 통합 (가장 강한 등급 채택)
2. **차단 결정 명시** — Critical 위험이 1건이라도 있으면 상단에 **BLOCK: YES**. 없으면 **BLOCK: NO**
3. **통합 순서 표** — integration-order-planner 결과를 사람이 읽기 쉬운 표로 (단계 / branch / base / 예상 conflict / 위험도)
4. **예상 conflict 표** — merge-conflict-analyzer 결과를 파일·hunk 별로 정리
5. **사용자 confirm 필요 지점** — Phase 2 의 사용자 결정 포인트들 (base 변경 / 순서 변경 / 일부 branch 제외 등) 명시
6. **권장 조치** — BLOCK 해소 우선, 그 다음 통합 시작 안내""",
    },
    "merge_conflict_resolver": {
        "ko_title": "Merge Conflict Patch 제안",
        "perspective": "특정 conflict 한 건에 대해 자동 해결 가능한 patch 를 unified-diff 형식으로 제안한다. **자동 적용은 호출자가 결정**.",
        "checklist": """1. **conflict 정보 추출** — prompt_file 에서 file path / base hunk / ours hunk / theirs hunk / branch 식별자 확인
2. **자동 해결 가능성 판단** — mechanical merge (import 정렬, 동일 의미 추가, 단순 리네임) 인지, semantic 변경인지
3. **mechanical patch 작성** — 가능하면 두 변경을 결합한 unified diff 를 `output_file` 에 Write
4. **semantic 충돌은 fatal** — 두 변경이 서로 다른 방향이면 patch 제안 금지, `STATUS=fatal` + output_file 에 충돌 사유 markdown 으로 기재
5. **부분 patch 가능 시** — 일부 hunk 만 자동 해결 + 일부는 사용자 결정 필요 → patch 본문에 `# UNRESOLVED` 마커
6. **사이드 이펙트 점검** — patch 가 의도하지 않은 hunk 를 건드리지 않도록 최소 범위 유지
7. **테스트·import 정합성** — patch 후 import / type 호환이 깨지지 않는지 정적 확인
8. **호출자에게 한 줄 응답 — patch 본문은 응답하지 말고 output_file 에만 작성**""",
    },
}

