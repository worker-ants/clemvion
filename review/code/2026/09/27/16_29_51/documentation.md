# 문서화(Documentation) 리뷰 — patch-body-followups (3R)

## 검증 방법

프롬프트에 게이트 번호로 인용된 diff 외에, 다음을 저장소에서 직접 `Read`/`Grep` 으로 열어 대조했다(read-only,
`git status --short` 로 시작·종료 시 워크트리 변화 없음을 확인):

- `codebase/backend/src/common/utils/omit-undefined.ts` 전문 — 새 JSDoc 문단과 실제 구현(`Object.fromEntries(Object.entries(obj)...)`)
  의 일치 여부
- `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` 전문 — `ipWhitelist` 필드·데코레이터
- `spec/5-system/2-api-convention.md` §5.4 — 테스트 주석이 인용하는 "tri-state" 개념·`UpdateAssistantSessionDto.llmConfigId`
  선례가 실재하는지
- `CHANGELOG.md` 상단 "무엇이 항목을 만드는가" 기준 전문
- `plan/in-progress/patch-body-followups.md` 전문(diff 가 생략된 파일) — 체크리스트·1R/2R 처분 이력
- `review/code/2026/09/27/15_46_38/documentation.md`, `review/code/2026/09/27/16_07_49/documentation.md` — 이전
  두 라운드가 이미 지적·처분한 문서화 발견사항이 이번 라운드에서 재발했는지

## 발견사항

- **[INFO — 확인됨, 재발 아님]** 2R WARNING("세 DTO 검증 spec 의 JSDoc 이 존재하지 않는 e2e 테스트명 `E` 를 인용")이
  이번 diff 에서 올바르게 처분됐다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts:128`,
    `codebase/backend/src/modules/nodes/dto/node-dto-validation.spec.ts:99`,
    `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:303`
  - 상세: 세 곳 모두 "그 회귀를 여기서 잡는다. 동작(null 이 값을 지운다)은 `test/patch-partial-body.e2e-spec.ts` 가
    본다." 로 바뀌어 있다 — 케이스 문자(`E`)를 빼고 파일명만 인용한다. `test/patch-partial-body.e2e-spec.ts` 의 실제
    테스트는 `E1`/`E2`/`E3` 세 개(각각 워크플로·노드·인증 설정)이므로, 파일명만 인용하는 현재 문구는 세 개로 쪼개져도
    깨지지 않는 안전한 교차참조다. 조치 불요.

- **[INFO — 확인됨, 재발 아님]** 1R INFO("세 DTO 중 `UpdateNodeDto.description` 만 필드-레벨 JSDoc 이 null 의미를
  반영하고 나머지 둘은 원문 그대로")도 이번 diff 에서 세 곳 모두 갱신돼 있다.
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`(`/** 변경할 설명 (null 이면
    지운다) */`), `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`(`/** 변경할 IP
    화이트리스트 (null · 빈 배열이면 전체 삭제) */`), `codebase/backend/src/modules/nodes/dto/update-node.dto.ts`
    (`/** 노드 설명 (null 이면 지운다) */`) — 세 필드 모두 인라인 JSDoc·`@ApiPropertyOptional` description 이 null
    의미를 일관되게 서술한다.

- **[INFO]** 테스트 주석이 인용하는 spec 조항·선례가 실재하며 정확하다 — 지어낸 근거가 아니다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 및
    `codebase/backend/src/modules/nodes/nodes.service.spec.ts` 의 "§5.4 tri-state 의 나머지 한 칸" 주석
  - 상세: `spec/5-system/2-api-convention.md:276-278` 이 정확히 "PATCH 부분 업데이트는 키 생략(=값 불변)·`null`(=초기화)·
    값(=설정)의 tri-state" 를 서술하고, 요청 DTO 에서 `@ApiPropertyOptional({ nullable: true }) + field?: T | null`
    조합을 `UpdateAssistantSessionDto.llmConfigId` 선례로 정당화한다 — 이번 PR 이 그 조항을 문자 그대로 따른다.
  - 판정: 조치 불요.

- **[INFO]** `omit-undefined.ts` 에 추가된 JSDoc 문단이 실제 구현·과거 장애와 정확히 일치한다.
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:21-23`
  - 상세: "인자 자체가 런타임에 `null` 이면 `Object.entries` 가 던진다" — 구현(`Object.entries(obj)`, 27번째 줄)이
    실제로 `null` 에 대해 `TypeError: Cannot convert undefined or null to object` 를 던지는 것과 일치한다. "타입은
    막지만 `@IsOptional()` 은 필드째 null 을 통과시킨다" 는 설명도 이 PR 의 근본 동기(워크플로 `settings: null` 500)를
    정확히 반영하며, 새로 추가된 캐너리(`omit-undefined.spec.ts` "인자 자체가 null 이면 TypeError 를 던진다")가 이
    계약을 테스트로 고정했다.

- **[INFO]** CHANGELOG 항목이 상단 기준(제품이 광고하는 API 계약 변화)에 정확히 부합하고, 발견됐지만 이번 PR 범위
  밖으로 미룬 결함("PATCH NOT NULL 필드에 null 을 보내면 500")은 CHANGELOG 에 올리지 않은 것이 맞는 판단이다.
  - 위치: `CHANGELOG.md:26-30`
  - 상세: 새 항목은 "동작 변화는 없다" 를 명시해 독자가 버그 수정으로 오인할 여지를 없앴다. 반면 새로 등재된 500
    버그(`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 백로그 항목)는 이번 PR 이 **고치지
    않은** 기존 결함이므로, CHANGELOG 상단 "항목을 낸다" 기준(제품 동작이 실제로 바뀌었을 때)에 해당하지 않는다 —
    CHANGELOG 에 올리지 않고 plan 트래커에만 등재한 것이 기준과 일치한다. 마찬가지로 이번 라운드에서 추가된 선언
    캐너리·unit 캐너리(가드 신설이 아니라 한 기능의 동작을 고정하는 커버리지)도 "항목을 내지 않는다" 목록에 해당해
    별도 CHANGELOG 항목이 불필요하다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 항목 좁히기가 취소선 관례를 지킨다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1404-1406` 부근
  - 상세: 원래 문구("PATCH 부분 본문 후속 — 요청 DTO `description` 의 nullable 선언 · 응답 직렬화 계층 부재 · 캐너리
    둘")를 지우지 않고 취소선(`~~...~~`)으로 남긴 뒤 "남은 것: 실행 상세 응답에 선언 없는 관계 둘"로 좁혔다 — 원문을
    지우면 다음 사람이 왜 좁혀졌는지 이력을 잃는데, 그 이력을 보존하는 형태다.

- **[INFO, 비차단]** `UpdateAuthConfigDto.ipWhitelist` 의 `@ApiPropertyOptional.example` 이 "값 설정" 예시
  (`['10.0.0.0/8', '203.0.113.42']`)만 있고 "null 로 지운다" 예시는 없다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:50-56`
  - 상세: 이번 PR 의 핵심이 "null 을 보내면 지운다" 는 신규 광고인데, Swagger UI 의 `example` 필드는 여전히 배열
    값 하나만 보여준다. `description` 텍스트에는 "null 전송 시 화이트리스트 전체 삭제" 가 산문으로 명시돼 있어
    실질적 정보 손실은 없다(같은 패턴이 `UpdateWorkflowDto.description`·`UpdateNodeDto.description` 에도 있고, OpenAPI
    3.0 은 필드당 example 을 보통 하나만 든다). 차단 사유 아님 — 후속 편집 시 고려할 수 있는 선택지로만 남긴다.

- **[INFO]** README·환경변수·배포 설정 문서는 이번 diff 범위와 무관하다 — 새 엔드포인트·설정·env var 없음.
  API 문서(OpenAPI 선언) 자체가 이번 변경의 본체이므로 별도 API 문서 갱신이 필요 없다(선언 갱신 = 문서 갱신).

## 요약

3R 시점 diff 는 1R·2R 이 지적한 두 문서화 이슈(필드별 JSDoc 불일치, 존재하지 않는 e2e 테스트명 `E` 를 가리키는
낡은 주석) 모두 올바르게 처분돼 있음을 코드를 직접 읽어 재확인했다 — 재발 없음. 신규 발견은 CRITICAL/WARNING
없이 INFO 수준 확인·관찰뿐이다: CHANGELOG 항목은 기준에 정확히 부합하고 범위 판단(제품 동작 변화 vs 미착수
백로그 vs 순수 테스트 커버리지)도 정확하며, 새 JSDoc(헬퍼·DTO·테스트 주석)은 실제 구현·spec 조항과 대조해도
정확했다. 유일한 비차단 관찰은 `ipWhitelist` OpenAPI `example` 이 "null 로 지운다" 값을 별도로 보여주지 않는다는
점인데, 산문 설명이 이미 그 의미를 명시하므로 실질적 결함은 아니다.

## 위험도

NONE
