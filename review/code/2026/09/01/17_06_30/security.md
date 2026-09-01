# 보안(Security) 리뷰

## 검토 방법

`meta.json` 기준 코드 스코프(`origin/main...HEAD`, `codebase/**` 8개 파일)를 저장소에서 직접
`Read`/`grep` 로 열어 실제 상태를 확인했다(프롬프트 diff 는 일부 파일이 "생략"돼 있어 원본을
전수 대조). 프롬프트에 포함된 `review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24}/**`
는 이미 5~6라운드에 걸쳐 수렴된 이전 리뷰 산출물이며, 그 내용 자체(리뷰 문서)는 이번 보안
관점 판정 대상이 아니다(코드가 아니다). `plan/`·`CHANGELOG.md` 는 서술 검토만 했다.

## 발견사항

- **[INFO]** `AuditLogsService.record()` catch 블록의 로그 메시지가 DB 드라이버 에러 문구
  (`err.message`)를 그대로 이어붙인다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` (내부
    `logger.warn` 호출, `catch (err)` 블록)
  - 상세: 에러 문구는 내부 DB 드라이버가 생성하는 값이라 사용자 입력이 직접 개입하지 않고,
    로그는 서버 내부 관측용(사용자에게 반환되지 않음)이라 정보 노출 위험은 낮다. 다만 이번
    diff 로 `action`/`resourceType`/`resourceId`/`workspaceId` 가 로그 문자열에 추가로
    인터폴레이션됐다 — 확인 결과 `resourceId`(주 호출부 `auth-configs.controller.ts`)는
    `ParseUUIDPipe` 로 검증되고, `action`/`resourceType` 은 코드가 정하는 열거형/상수라
    자유 텍스트가 아니다. CRLF 삽입 등 로그 위조(log forging) 표면은 실질적으로 닫혀 있다.
  - 제안: 조치 불필요. 향후 `resourceId`/`workspaceId` 를 검증되지 않은 자유 문자열을 받는
    호출부에서 쓰게 되면 그때 재검토.

- **[INFO]** `recordAuditWriteFailed(resourceType: string)` 의 cardinality 방어가 닫힌
  유니온이 아니라 `clampLabel()`(64자 truncate)에 의존한다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`clampLabel`,
    `recordAuditWriteFailed`)
  - 상세: `AuditLogsService.record()` 시그니처의 `resourceType: string` 이 열려 있어
    컴파일러가 닫힌 집합임을 증명하지 못한다는 점을 코드 주석이 스스로 정확히 밝히고 있다.
    현재 모든 호출부는 내부 상수(`AUTH_CONFIG_RESOURCE_TYPE` 등 10종)만 넘기므로 사용자
    입력이 라벨로 직접 흘러들 경로는 없다 — Prometheus label cardinality 폭발이라는
    가용성 리스크에 대한 실질 방어(truncate)는 존재한다.
  - 제안: 조치 불필요. 이미 문서화된 트레이드오프이며 `record()` 가 닫힌 유니온으로
    좁혀지면 동반 좁힘이 맞다고 주석이 명시한다.

- **[INFO]** `auth-configs.service.ts` 의 `recordAudit` 타입 좁힘(`AuditAction` →
  `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`)은 컴파일 타임 전용이며 감사 무결성을
  강화하는 방향의 변경
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
    `recordAudit()` 파라미터 타입
  - 상세: 종전에는 `auth_config` 리소스의 `recordAudit` 만 5개 자매 helper와 달리 리소스에
    묶이지 않은 전체 union 타입을 받아, 다른 리소스의 액션 리터럴을 `resourceType:
    'auth_config'` 로 기록해도 컴파일러가 잡지 못했다(대조군 프로브로 실측 확인됨:
    `schedules` 에서는 동일 오귀속이 `TS2322`). 감사 로그는 사고 대응(계정 탈취 후 시크릿
    회전 이력 재구성 등)의 신뢰 기반이므로, 액션-리소스 오귀속을 컴파일 타임에 막는 것은
    보안 관점에서 순수한 개선이다. 런타임 쿼리·데이터 흐름에는 영향이 없다.
  - 제안: 없음.

- **[INFO]** 신규 정적 가드(`audit-action-binding-guard.ts`)가 `resourceType` 오귀속을
  선언 단계에서 잡는 보조 방어선을 추가
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    (`findUnboundHelpers`, `findMisboundHelpers`)
  - 상세: 컴파일러 자체 방어는 호출부 존재 여부에 의존한다는 사실이 5라운드 리뷰에서
    뮤테이션으로 확정됐고(오귀속 뮤턴트가 `tsc` 에러 5건을 내는데 전부 호출부에서 발생,
    `_NoCrossDomain` 캐너리를 지워도 동일), 이 가드는 그 간접 방어가 닿지 않는 자리
    (호출부가 아직 없는 helper·화살표 함수 클래스 필드 선언)를 fixture 로 커버한다.
    화살표 함수 필드 형태는 실측상 종전 가드가 탐지 0건이었던 사각지대였고 이번에
    닫혔다(`ARROW_FIELD_BARE_SOURCE`/`ARROW_FIELD_BOUND_SOURCE` fixture + 뮤테이션
    검증 기록 존재). 신규 의존성 추가 없음(`typescript`/`node:fs`/`node:path` 는 형제
    가드 `engine-error-code-anchor-guard.ts` 가 이미 쓰는 패턴).
  - 제안: 없음.

- **[INFO]** 관측 호출(`metrics?.recordAuditWriteFailed`)을 자체 `try`/`catch` 로 이중
  격리해 swallow 계약(chokepoint 가용성 보호)이 손상되지 않게 함
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch
    블록 내부
  - 상세: 감사 로깅은 시크릿 회전/삭제 등 12개+ 특권 CRUD 경로가 공유하는 chokepoint이며,
    이 메서드의 존재 이유가 "감사 실패가 본 요청을 절대 깨뜨리지 않는다"는 가용성 계약이다.
    새로 추가한 관측 호출이 그 계약을 역행하는 새 실패 경로가 되지 않도록 별도로
    감싼 것은 보안(가용성) 관점에서 올바른 설계다. `audit-logs.spec.ts` 에 "metrics 호출이
    던져도 삼킨다" 테스트와 `@Optional()` DI 미조립 테스트가 실제 뮤테이션 검증(RED)과
    함께 존재한다.
  - 제안: 없음.

- **[INFO]** `AuditLogsService.findAll` 쿼리 빌더는 이번 diff 로 변경되지 않았으나 재확인 결과
  전 필터가 파라미터 바인딩(`:workspaceId` 등)을 사용하고 `sort` 는 화이트리스트
  (`getSortColumn`)로 제한돼 SQL 인젝션 표면이 없다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `findAll()`
  - 상세: 참고용 확인 — 이번 diff 의 영향 범위 밖.
  - 제안: 없음.

CHANGELOG.md, `plan/**` 문서에는 하드코딩된 시크릿·자격증명·평문 전송·안전하지 않은
암호화 알고리즘 언급이 없다. `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
전체를 열어 확인했을 때도(diff 범위 밖이지만 문맥 확인 차원) HMAC 알고리즘 화이트리스트,
비밀값 자동 발급 강제, 마스킹 응답 등 기존 방어가 이번 diff 로 훼손되지 않았다.

## 요약

이번 changeset 은 (1) 감사 로그 적재 실패를 OTel 카운터·상세 로그로 관측 가능하게 하고,
(2) `auth_config` 감사 helper 의 `action` 파라미터를 리소스에 묶인 타입으로 좁혀 이전에
컴파일러가 잡지 못하던 액션-리소스 오귀속 구멍을 닫았으며, (3) 그 바인딩 불변식을 전수
강제하는 신규 AST 정적 가드를 추가했다. 세 변경 모두 보안(감사 무결성·가용성·관측성)을
강화하는 방향이며, 인젝션·인증/인가 우회·하드코딩된 시크릿·안전하지 않은 암호화·민감정보
노출에 해당하는 신규 결함은 발견되지 않았다. 신규 정적 가드의 로그 메시지 확장·라벨
클램핑 모두 입력 출처가 검증된 값(UUID·내부 상수)으로 제한돼 있어 로그 위조나 cardinality
공격 표면도 실질적으로 닫혀 있다. 이 changeset 은 이미 5~6라운드의 코드 리뷰를 거쳐
Critical 0으로 수렴한 상태이며, 이번 독립 검토도 같은 결론이다.

## 위험도

NONE
