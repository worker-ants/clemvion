# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 조사 방법 메모

`diff-base=origin/main` 대비 실제 변경분을 `git diff origin/main -- spec/` 로 먼저 특정했다(번들
전문 3017줄 중 실제 target diff 는 2개 파일·43줄뿐). 이어서 대응 코드 diff
(`codebase/backend/src/modules/external-interaction/**`,
`codebase/backend/src/modules/execution-engine/**`,
`codebase/backend/src/shared/utils/terminal-duration.ts`)를 워킹트리 절대경로 기준으로 대조했다.
동일 세션 앞선 시각의 `review/consistency/2026/08/15/13_43_10/naming_collision.md` (더 이른 커밋 시점 검토)도
비교 참고했다 — 이번 diff 는 그 시점 이후 추가된 증분(`durationMs` §5.3 GET 확장 + `finalizeCancelledExecution`
가드 정정 + `toPersistedDate` 신규 헬퍼)만 다룬다.

**실제 target diff** (origin/main 대비):
- `spec/5-system/14-external-interaction-api.md` — EIA-IN-04 서술에 `durationMs` 추가, §5.3 GET
  응답 예시에 `durationMs` 필드 신설, §6.4 Rationale 콜아웃의 "알려진 예외 1건" 을 해소 완료로 정정.
- `spec/conventions/node-cancellation.md` — `finalizeCancelledExecution` (기존 식별자) 관련 테이블 행
  1개 추가 + Rationale 문단 정정("guarded UPDATE 가 걸러낸다" → "0행 매칭되나 반환을 읽어야 skip 된다").
- 코드: `execution-status-response.dto.ts`(`durationMs` 필드 추가), `interaction.service.ts`
  (`durationMs` 프로젝션 컬럼 추가), `execution-engine.service.ts`(`finalizeCancelledExecution` 가드
  로직 정정, 신규 식별자 없음), `retry-turn.service.ts`(`toPersistedDate` 신규 헬퍼 호출 추가),
  `terminal-duration.ts`(`toPersistedDate` 함수 신규 export).

## 발견사항

이번 diff 가 실제로 **새로 도입하는 식별자**는 매우 좁다.

- **[INFO]** `durationMs` 를 §5.3 (`GET /api/external/executions/:executionId`) 응답에 확장
  - target 신규 사용처: `spec/5-system/14-external-interaction-api.md` §5.3 GET 상태 조회 응답의
    `durationMs` 필드 (EIA-IN-04)
  - 기존 사용처: 같은 문서 §6 종결 이벤트 payload (`execution.completed`/`failed`/`cancelled`) 의
    `durationMs`, `Execution` 엔티티의 `duration_ms` 컬럼, 그리고 코드베이스 전역의 `meta.durationMs`
    관례(`spec/4-nodes/4-integration/0-common.md` §6.1 등)
  - 상세: 신규 식별자가 아니라 **이미 정의된 필드명을 동일 의미로 다른 진입점에 재노출**한 것이다.
    diff 자체가 "종결 이벤트 §6 의 같은 이름 필드와 같은 값이다(영속 컬럼을 그대로 싣는다, 재계산 아님)"
    라고 명시하고, 코드(`interaction.service.ts`)도 `execution.durationMs ?? null` 로 동일 컬럼을
    그대로 투영해 wire 값 일치를 보장한다. 취소·타임아웃 경로에서 "실행 시간"이 아니라 "대기 경과
    시간"이라는 의미 캐비엇은 이전 세션 검토(`13_43_10/naming_collision.md`)에서 이미 INFO 로 지적됐고
    target 문서가 §6.5 주석·§5.3 신규 콜아웃 양쪽에서 명시적으로 재확인한다. 충돌이라기보다 캐비엇의
    적용 범위가 넓어진 것.
  - 제안: 조치 불요. 이미 문서가 caveat 을 §5.3 콜아웃에도 미러링해 두었다.

- **[INFO]** `toPersistedDate` 신규 유틸 함수
  - target 신규 식별자: `codebase/backend/src/shared/utils/terminal-duration.ts` 의
    `export function toPersistedDate(v: unknown): Date | null`
  - 기존 사용처: 없음 — `git grep -n "toPersistedDate"` 전수 결과 정의처 1곳(`terminal-duration.ts`)
    + 호출처 1곳(`retry-turn.service.ts`) + 테스트 1곳(`terminal-duration.spec.ts`) 뿐. 동명 함수·
    타입이 다른 의미로 codebase 어디에도 없음.
  - 상세: `toFiniteNumber` (기존 자매 함수, 같은 파일 이미 존재)의 Date 버전으로, pg `RETURNING` 이
    돌려주는 `timestamptz` 를 `Date | string` 어느 쪽으로 오든 안전하게 파싱하는 순수 내부 헬퍼다.
    spec 에 별도 요구사항 ID 로 노출되지 않으며(구현 세부), 공개 API 표면·엔티티·이벤트명과 무관.
  - 제안: 조치 불요. 충돌 없음.

- **[정보 없음]** `finalizeCancelledExecution` (신규 아님)
  - 이번 diff 는 `spec/conventions/node-cancellation.md` 테이블에 이 함수를 언급하는 행을 새로
    추가하지만, `origin/main` 시점에도 같은 문서 Rationale 절(§ "취소 시각 보존" 문단)에 이미
    `finalizeCancelledExecution` 이 언급돼 있었다(`git show origin/main:spec/conventions/node-cancellation.md`
    로 대조 확인, line 208). 함수 자체도 `execution-engine.service.ts` 기존 코드다. 신규 식별자가
    아니므로 충돌 검토 대상이 아니다.

## 충돌 없음 확인 (grep 실측)

- **요구사항 ID**: 이번 diff 는 신규 `EIA-xx-nn` ID 를 추가하지 않는다 — 기존 EIA-IN-04 행의 서술만
  확장. ID 충돌 없음.
- **엔티티/타입명**: `durationMs`(재사용, 위 참조), `toPersistedDate`(신규, 유일 정의처) 외 신규
  타입/DTO/인터페이스 없음. `ExecutionStatusDto.durationMs?: number | null` 필드 추가는 기존 DTO
  클래스에 필드를 얹은 것이라 클래스명 충돌 없음.
- **API endpoint**: 신규 endpoint(method+path) 없음 — 기존 §5.3 `GET /api/external/executions/:executionId`
  응답 스키마에 필드만 추가.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트명 없음.
- **환경변수·설정키**: 신규 ENV var·config key 없음.
- **파일 경로**: 신규 spec 파일 없음(기존 2개 파일 수정만). 신규 코드 파일도 없음 — 기존
  `terminal-duration.ts`(shared/utils, 기존 명명 컨벤션에 이미 편입된 파일)에 함수 추가.

## 요약

이번 target diff(origin/main 대비 spec 2파일 43줄 + 대응 코드)는 신규 식별자 표면이 매우 작다.
`durationMs` 필드를 §5.3 GET 상태 조회 응답에도 노출한 것은 신규 식별자가 아니라 이미 §6 종결 이벤트·
Execution 엔티티·코드베이스 전역 관례에서 확립된 필드명을 동일 의미로 재사용한 것이며, 취소/타임아웃
경로의 의미 캐비엇도 문서가 스스로 명시한다. 유일한 진짜 신규 식별자는 내부 유틸 함수
`toPersistedDate` 하나로, 전수 grep 상 다른 곳에서 다른 의미로 쓰이는 사례가 없다. 요구사항 ID·
API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 어느 카테고리에서도 충돌을 발견하지 못했다.

## 위험도

NONE
