# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** spec frontmatter `code:` 파서가 Python(hooks)과 TypeScript(frontend) 양쪽에 독립 구현되어 있고, 이번 diff 는 그 발산이 실제로 41개 entry 유실을 낸 뒤의 증상 패치다 — 구조적 SSOT 부재는 남았다
  - 위치: `.claude/hooks/_lib/review_guard.py:637-658` (`_parse_frontmatter_code` 블록 리스트 루프) vs `codebase/frontend/src/lib/docs/registry.ts:211,313` (`gray-matter` 기반 파서)
  - 상세: 커밋 메시지·인라인 주석 스스로 밝히듯, 두 파서가 **같은 YAML 스펙**(spec 문서의 `code:` 블록 리스트)에 대해 서로 다른 답을 냈다 — Python 쪽은 `- ` 아닌 첫 줄에서 무조건 `break` 했고, `gray-matter` 는 처음부터 주석 뒤를 봤다. 이번 수정은 "빈 줄·`#` 주석은 건너뛴다"는 **한 가지 발산 형태**만 닫았을 뿐, 두 파서가 같은 입력 언어를 각자 손으로(또는 라이브러리로) 재구현하고 있다는 구조 자체는 그대로다. 앞으로 앵커/별칭, 여러 줄 문자열, 다른 주석 스타일 등 YAML 의 다른 형태가 등장하면 같은 클래스의 발산이 다시 날 수 있고, 그 결과가 "게이트가 안 무는 쪽이 기본값" 이라는 fail-open 방향이라 발견이 어렵다(이번에도 41개 중 하나가 우연히 자기 작업 파일을 덮어서야 발견됐다).
  - 제안: 두 파서를 한쪽으로 합치기 어렵다면(언어 경계), 최소한 **동일 golden fixture 코퍼스**(주석·빈 줄·중첩·인라인 배열 등 케이스 모음)를 두 언어 테스트가 함께 참조해 "같은 입력 → 같은 출력" 을 명시적으로 단언하는 회귀 테스트를 추가해 암묵적 일치 가정을 검증 가능한 계약으로 바꾼다.

- **[INFO]** `WorkflowVersionDetail` 타입명이 백엔드·프런트엔드에 독립적으로 존재하며 필드 형태가 이미 갈려 있다 — 저자가 스스로 3회 재발한 오판(같은 이름=같은 정의)으로 문서화했다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:61-64` vs `codebase/frontend/src/lib/api/workflows.ts:109`
  - 상세: 백엔드 타입은 이번 PR 에서 `creator: { id, name, email }` **3필드 고정**으로 좁혀졌고, 프런트엔드의 동명 타입은 `creator?: { id, name?, email? } | null` 로 더 넓다. 공유 타입 패키지를 거치지 않는 손 미러라 컴파일러가 두 자리의 정합을 보장하지 않고, 그 이름 동일성이 이미 세 차례 리뷰 라운드에서 "유일 정의" 오판을 만들었다(주석에 직접 기록됨: `review/consistency/2026/09/06/13_39_25` W3). 이는 모듈 경계(FE/BE) 가 타입 수준에서 흐릿하다는 신호이고, 이번처럼 한쪽만 좁히는 변경이 반복되면 두 계약이 자기도 모르게 벌어질 위험이 구조적으로 남는다. PR 저자도 이를 인지해 범위 밖으로 명시 이관했으므로 새로 지적할 결함이라기보다, 다음에 이 타입을 만지는 사람이 놓치지 않도록 별도 추적이 필요하다는 확인 차원의 기록.
  - 제안: (이번 PR 범위 밖) 후속으로 두 타입 중 하나를 개명하거나, OpenAPI 스키마에서 파생한 공유 타입 생성 파이프라인으로 이관해 이름 동일성이 곧 계약 동일성이 되게 한다.

- **[INFO]** `WorkflowVersionsService.findByWorkflow`/`findOne` 의 `select` 객체가 `creator` 를 제외한 7개 키(`id`/`workflowId`/`version`/`changeSummary`/`createdBy`/`createdAt` + `snapshot` 유무)를 여전히 손으로 두 번 나열한다 — 이번 PR 이 고친 바로 그 결함 클래스(같은 리터럴이 두 곳에 복제돼 한쪽만 갱신됨)가 `creator` 축은 `CREATOR_PROJECTION` 상수로 닫혔지만 나머지 축엔 남아 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:126-134`(`findByWorkflow`), `:152-161`(`findOne`)
  - 상세: 두 `select` 리터럴은 `snapshot` 한 필드 차이를 빼면 동일하다. `creator` 하나만 상수화한 것은 정확히 이번 PR 이 겪은 실제 사고(자매 메서드 중 하나만 투영을 갖고 있었다)를 예방하는 조치이므로 방향은 맞지만, 같은 논리를 나머지 공유 필드 목록에는 적용하지 않아 "다음 컬럼이 하나 늘 때 두 자리 중 하나만 갱신되는" 같은 형태의 위험이 축소된 범위로 남아 있다.
  - 제안: 공유되는 6개 키를 `BASE_VERSION_SELECT` 같은 상수로 뽑고 `{ ...BASE_VERSION_SELECT, snapshot: true, creator: CREATOR_PROJECTION }` 형태로 스프레드해 `findOne` 을 조립하면, 두 조회의 공통 계약이 코드 수준에서 한 곳에만 존재하게 된다.

## 요약

핵심 변경(`WorkflowVersionsService` 의 `creator` 투영 상수화 + 타입 좁히기, `User` 컬럼 노출 검출 3축 가드 신설)은 SOLID·응집도 관점에서 전반적으로 탄탄하다. 새 가드들(`user-entity-exposure-guard.ts`/`user-secret-absence.ts`/`dto-jsdoc-citation-guard.ts`)은 기존 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`)가 확립한 "순수 스캔 로직 / 소비 spec 분리" 관례를 그대로 따르고, `dto-jsdoc-citation-guard.ts` 가 `isResponseDtoFile` 판정 로직을 재구현하지 않고 `swagger-dto-contract-guard.ts` 에서 재사용한 것, `workflow-versions.service.spec.ts` 가 `CREATOR_PROJECTION` 을 손으로 적은 목록이 아니라 실제 생성된 OpenAPI 스키마와 대조해 계약을 코드로 강제한 것은 모두 DIP·단일 진실 원천 원칙을 잘 지킨 사례다. 순환 의존성은 발견되지 않았고, `User` 타입 관계를 이름 나열이 아니라 엔티티 타입 주석에서 파생시키는 설계(`collectUserRelationNames`)는 개방-폐쇄 원칙에 부합하는 좋은 추상화 레벨 선택이다. 다만 두 가지는 구조적으로 남겨 둔 위험이다: (1) spec frontmatter 파서가 Python/TS 양쪽에 독립 구현돼 있고 이번 diff 의 근본 원인이 바로 그 발산이었는데, 이번 수정은 발견된 한 형태만 닫았을 뿐 재발을 막는 계약(공유 fixture 등)은 아직 없다. (2) `WorkflowVersionDetail` 이름이 FE/BE 에 독립 정의돼 있고 필드 형태가 이미 갈렸다는 사실을 저자 스스로 인지·기록했지만 이번 PR 범위 밖으로 이관했다. 두 항목 모두 즉각적인 결함이라기보다 "다음에 같은 자리를 또 건드릴 때" 재발 가능한 구조적 취약점이라 WARNING/INFO 로 기록한다.

## 위험도

LOW
