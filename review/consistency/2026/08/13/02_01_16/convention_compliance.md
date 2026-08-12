# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-redis-key-registry.md`

## 검토 방법

target(spec draft plan)의 실측 주장(§9.1 패턴, §9.2 phantom 2건, `exec:seq` 중복 등재, 6개 영역 12계열
분산)을 `spec/5-system/4-execution-engine.md` §9·`spec/data-flow/15-external-interaction.md` §2.2·
관련 코드(`app.module.ts`, `ws-rate-limiter.service.ts`, `interaction-rate-limiter.service.ts`,
`outbound-notification-rate-limiter.service.ts`)에 직접 대조해 사실관계를 확인했고, target 이 신설
제안하는 `spec/conventions/redis-keys.md` 가 기존 `spec/conventions/**` 18개 비-카탈로그 문서의 구조
관례 및 `spec/conventions/spec-impl-evidence.md`(frontmatter 의무 규약)와 맞는지 대조했다.

## 발견사항

- **[WARNING] 신설 예정 `spec/conventions/redis-keys.md` 의 필수 frontmatter(id/status/code) 계획이 draft 에 없음**
  - target 위치: "### 1. `spec/conventions/redis-keys.md` 신설 — 규약 SoT" 의 "담을 것:" 목록(명명 규칙·
    워크스페이스 스코프·전역 인벤토리) 및 체크리스트 2번째 항목(`spec/conventions/redis-keys.md` 신설)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1(적용 대상)·§2(frontmatter 스키마)·§4(build 가드
    `spec-frontmatter.test.ts`/`spec-code-paths.test.ts`)
  - 상세: `spec/conventions/**.md` 는 §1 의 inclusive list 에 있고, `redis-keys.md` 는 그 §1 의 **제외
    목록**(basename `0-overview.md`/`1-data-model.md`/`6-brand.md`, `_*.md`, 카탈로그 리소스 하위 파일)
    어디에도 해당하지 않는다 — 즉 `id`/`status` frontmatter 는 build-time 가드로 강제되는 **의무**다.
    실제로 확인한 18개 비-카탈로그 conventions 파일(`audit-actions.md`·`error-codes.md`·`migrations.md`·
    `secret-store.md`·`cross-node-warning-rules.md` 등) 전부가 예외 없이
    `id`/`status`/`code:` frontmatter 를 갖고 있는데, target 의 "담을 것" 목록에는 이 스키마 자체가
    언급되지 않는다. 더 나아가 이 문서는 자기 스스로 "코드 소유가 6개 영역(exec/eia/iext/cc/wh/cafe24/
    background/integration)에 흩어져 있다" 고 실측했으므로, `code:` glob 이 `error-codes.md → error-codes.ts`
    처럼 단일 파일을 가리킬 수 없다 — `status: implemented` 라면 `spec-code-paths.test.ts` 가 `code:`
    글로브 ≥1 매치를 강제하는데, 이 문서 하나로 12계열 전체를 커버하려면 6개 모듈에 걸친 다중 glob
    배열(예: `migrations.md` 가 이미 쓰는 이종 다중 경로 패턴)이 필요하고, 이 설계 판단이 draft 에
    전혀 다뤄지지 않았다.
  - 제안: "담을 것" 목록에 frontmatter 계획을 명시 (`id: redis-keys`, `status: implemented`,
    `code:` — exec/EIA/chat-channel/webhook/cafe24/background 각 소유 모듈 경로의 다중 glob 배열)하고,
    체크리스트에 "frontmatter(id/status/code) 부여" 항목을 별도로 추가한다. `code:` 가 단일 파일이 아닌
    이유(스코프가 본질적으로 분산)는 Rationale 에 한 줄 남겨두면 향후 재작성 압력을 막는다.

- **[INFO] 신설 문서 서두 구조가 기존 conventions 관례(Overview + 책임 경계)를 아직 명시하지 않음**
  - target 위치: "### 1. `spec/conventions/redis-keys.md` 신설" 섹션 전체
  - 위반 규약: 공식 규약은 아님 — `error-codes.md`/`audit-actions.md`/`secret-store.md` 등에서 관찰되는
    사실상 표준 패턴(비공식): `## Overview` + "책임 경계"(다른 문서가 SoT 인 항목 목록) + "본 문서가
    유일하게 소유하는 것" 요약
  - 상세: target 은 §9.2/data-flow §2.2 를 "포인터"로 남긴다고 명확히 서술해 이 패턴의 정신은 이미
    따르고 있으나, 실제 작성 시 다른 conventions 문서와 동일한 골격(Overview 절 + 명시적 책임 경계
    bullet)을 쓰면 문서군 일관성이 좋아진다.
  - 제안: 실제 spec 반영 단계에서 `error-codes.md` §Overview 형식을 참고해 구조를 맞출 것을 권고
    (draft 자체의 결함은 아님).

- **[INFO] `4-execution-engine.md` §9.1 인바운드 크로스레퍼런스 — heading 텍스트 보존 필요**
  - target 위치: "### 2. `4-execution-engine.md` §9.1 / §9.2 정정" 표의 §9.1 행
  - 위반 규약: 직접적인 conventions 위반은 아니고 링크 무결성 주의사항(`spec-impl-evidence.md` §4.2
    계열 가드와 인접한 관심사)
  - 상세: `spec/conventions/execution-context.md:62` 가 `[execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴)`
    로 이 절을 앵커 링크 참조 중이다. target 의 spec_impact 에는 `execution-context.md` 가 없으므로
    (직접 수정 대상이 아니라 맞음) 문제는 없으나, §9.1 본문을 "규약 문서 참조로 대체"할 때 heading
    텍스트(`### 9.1 키 패턴`) 자체를 바꾸면 이 인바운드 앵커가 깨진다.
  - 제안: 체크리스트 §9.1 항목에 "heading 텍스트는 유지, 본문만 규약 참조로 교체" 를 한 줄 명시.

## 사실관계 검증 메모 (참고)

target 의 핵심 주장은 모두 코드/spec 대조로 확인됐다 — §9.1 패턴 위반 100%, §9.2 phantom 2건
(`core:{wsId}:rate:{userId}` — `@nestjs/throttler` 기본 in-memory storage, `app.module.ts` 확인;
`ws:{wsId}:session:{connId}` — `ws-rate-limiter.service.ts` 무-Redis 확인), `exec:seq:<executionId>`
가 `4-execution-engine.md` §9.2 와 `data-flow/15-external-interaction.md` §2.2 양쪽에 중복 등재,
EIA rate-limit 키 3종(`eia:rl:interact`·`eia:rl:status`·`eia:notif:rl`)이 코드에는 있으나 두 레지스트리
어디에도 없음 — 모두 실측대로였다. 이 사실관계 정확성은 정식 규약 준수와 별개 축이라 위 발견사항
등급에는 반영하지 않았다.

## 요약

target 은 project-planner SKILL.md 의 "spec draft" 워크플로(파일명 `spec-draft-<name>.md`, frontmatter
3필드+`spec_impact` 리스트, `## Rationale` 포함)와 CLAUDE.md 의 "정식 규약 → `spec/conventions/<name>.md`"
원칙을 정확히 따르고 있고, 실측 근거도 코드 대조로 전부 검증됐다. 유일한 실질적 갭은 신설 예정
`redis-keys.md` 가 `spec-impl-evidence.md` 가 강제하는 frontmatter(id/status/code) 의무 대상인데 draft
가 이를 계획에 담지 않았다는 점 — 특히 이 문서의 코드 소유가 6개 모듈에 분산돼 있어 `code:` 글로브
설계 자체가 자명하지 않으므로, spec 반영 직전에 명시적으로 다뤄야 build-time 가드
(`spec-frontmatter.test.ts`/`spec-code-paths.test.ts`) 실패를 피할 수 있다. 그 외에는 CRITICAL 급 위반
없음.

## 위험도

MEDIUM
