# 정식 규약 준수 검토 — spec/data-flow/ (--impl-done)

## 검토 범위 및 방법

- 대상: `spec/data-flow/` (impl-done bundle). 예산 내 전문이 실린 문서는 `9-observability.md`·
  `14-chat-channel.md`·`15-external-interaction.md`·`0-overview.md`·`1-audit.md`·`2-auth.md`·
  `3-execution.md` 7개, 나머지 9개는 절단됐다(내용 없음이 아니라 예산 절단).
- 실제 코드 diff(`origin/main...HEAD`)는 프롬프트 안에 `<git diff origin/main...HEAD --
  code_areas>` 섹션으로 포함되어 있었고(`spec/data-flow/15-external-interaction.md` 블록
  직후), 절대경로 워킹트리(`.../eia-idem-resolve-cache-hit-36acd6`)로 재확인한 `git diff
  origin/main HEAD -- codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  와 문자 그대로 일치한다. 이번 브랜치의 코드 변경은 **그 파일 1개**뿐이고 `spec/**` 는
  전혀 건드리지 않았다(`git diff --stat origin/main HEAD -- spec/` 빈 결과).
- 변경 내용은 `intercept()` 의 `switchMap` 콜백 본문을 `private resolveCacheHit(cachedJson,
  lookup: CacheLookup)` 메서드로 추출한 **순수 구조 리팩터**다 — 분기 판정 로직·에러 코드·
  Redis 키·응답 shape 모두 동일(`git diff` 상 로직 라인은 들여쓰기만 바뀌었을 뿐 내용 무변경).
- 이 작업은 이미 두 라운드의 독립 검토를 거쳤다: 코드 리뷰 `review/code/2026/08/29/17_32_16`
  (RISK=LOW, Critical/Warning 0, INFO 13건 전건 처분 — `RESOLUTION.md`)과 정식 규약 검토
  `review/consistency/2026/08/29/17_23_43/convention_compliance.md`(spec/5-system/ 스코프,
  발견 없음). 본 리포트는 스코프만 `spec/data-flow/` 로 바꾼 동일 커밋의 재검토다.

## 대조 결과 (관점별)

### 1. 명명 규약
- 신규 식별자는 `CacheLookup`(interface)·`resolveCacheHit`(private method) 둘뿐이며 둘 다
  모듈 내부 전용(export 없음) — API endpoint·DTO·Redis 키·에러 코드 등 `spec/conventions/**`
  가 형태를 규정하는 표면에 해당하지 않는다. `interaction:idempotency:<executionId>:<route>:
  <key>` Redis 키(`redis-keys.md §1`·§3 인벤토리에 이미 등재)와 `IDEMPOTENCY_KEY_CONFLICT`
  에러 코드는 이번 diff 에서 문자 그대로 보존됐다(`git diff` 상 `-`/`+` 양쪽 동일 리터럴).
- `CacheLookup.context: ExecutionContext` 는 NestJS `NestInterceptor.intercept(context:
  ExecutionContext, ...)` 시그니처가 이미 강제하던 타입을 그대로 옮긴 것 — 워크플로우 엔진
  도메인의 `ExecutionContext`(`spec/conventions/execution-context.md`)와 이름이 겹치지만
  이는 프레임워크 인터페이스가 강제하는 기존 이름이며 이번 리팩터가 새로 만든 충돌이 아니다
  (`intercept()` 시그니처는 diff 밖). 신규 충돌 판정은 naming_collision 검토의 영역이라
  등급 없이 언급만 남긴다.

### 2. 출력 포맷 규약
- `resolveCacheHit()` 의 7갈래 응답 판정(캐시 미스/엔트리 손상/형태 불일치/bodyHash 불일치/
  payload 손상/409·410 예외 재현/2xx 성공 재현)은 [`15-external-interaction.md` §2 Redis 표
  R8](../../../../../../spec/data-flow/15-external-interaction.md)·[Spec EIA §R8] 이 규정한
  "캐시 대상 닫힌 목록(2xx·409·410, 400 VALIDATION_ERROR 제외) + 손상 시 fail-open" 서술과
  그대로 일치 — 새 분기(#3 엔트리 형태 불일치)도 R8 의 "손상 엔트리는 버리고 신규 처리로
  강등" 범위 안이라 spec 갱신 없이도 drift 가 아니다. 응답 봉투(`{ error: { code, message } }`
  / 캐시 재현 시 원 payload pass-through)도 무변경.

### 3. 문서 구조 규약
- `spec/data-flow/15-external-interaction.md` 는 `## Overview` → `## 1~4` 본문 →
  `## Rationale` 3섹션 구조를 유지(§Overview 76행 · §Rationale 930행대, 프롬프트 기준)하고
  있고, 코드 진입점 목록의 `idempotency.interceptor.ts` — `Idempotency-Key 24h Redis 캐시`
  서술은 리팩터 후에도 정확하다(외부 동작 무변화). `0-overview.md` 는 `0-` prefix, `Overview
  (제품 정의)` 절 명명 규칙을 지킨다. 이번 diff 로 이 구조를 깨는 편집은 없다(spec 파일
  자체가 diff 대상이 아님).

### 4. API 문서 규약 (swagger.md)
- `idempotency.interceptor.ts` 는 `NestInterceptor` 이며 컨트롤러 데코레이터·DTO 를 정의하지
  않는다 — swagger.md 가 규정하는 표면(데코레이터·`dto/responses/*-response.dto.ts` 명명 등)에
  이번 diff 가 관여하지 않는다. 해당 없음.

### 5. 금지 항목
- Redis 키에 워크스페이스 세그먼트를 넣는 패턴, 카탈로그 미등재 인라인 에러 코드, 이중 응답
  래핑 등 conventions 가 명시 금지한 패턴이 diff 안에 재도입된 곳은 없다(순수 구조 이동이라
  신규 문자열 리터럴 자체가 없음 — 전부 기존 리터럴의 위치만 이동).

## 발견사항

없음 — 검토 범위(spec/data-flow/ 전문 번들 7개 + 절대경로 워킹트리로 재확인한 diff) 안에서
CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다.

- **[INFO]** 이전 라운드 대비 델타 없음
  - target 위치: `spec/data-flow/15-external-interaction.md` §1.5 코드 진입점 목록,
    `spec/conventions/redis-keys.md §3` 인벤토리
  - 위반 규약: 해당 없음
  - 상세: `review/consistency/2026/08/29/17_23_43/convention_compliance.md` 가 같은 커밋의
    같은 관점(명명/출력 포맷/문서 구조/API 문서/금지 항목)을 `spec/5-system/` 스코프로 이미
    검토해 발견 없음으로 닫았다. 이번 회차는 스코프만 `spec/data-flow/` 로 바뀌었을 뿐 코드
    diff·conventions 문서 모두 그 사이 변경이 없다(`git log` 상 두 회차 사이 커밋은
    `resolveCacheHit()` 자체의 커밋(`49b9f92b5`)과 리뷰 산출물 이관 커밋(`6cb32c862`)뿐이며
    후자는 `review/`·`plan/` 만 건드림).
  - 제안: 조치 불요 — 동일 결론의 2차 확인으로 기록만 남긴다.

## 요약

브랜치 `eia-idem-resolve-cache-hit` 의 코드 변경은 `idempotency.interceptor.ts` 1개 파일의
순수 구조 리팩터(`switchMap` 콜백 → `resolveCacheHit()` 사설 메서드 추출)이며 Redis 키 형태·
에러 코드·응답 shape·spec 문서 구조 어느 것도 바꾸지 않는다. `spec/data-flow/` 스코프로 다시
대조한 결과 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점 모두에서 정식 규약 위반을
발견하지 못했다 — 앞선 `17_23_43` 회차(spec/5-system/ 스코프)와 동일한 결론이다. 신규
식별자(`CacheLookup`·`resolveCacheHit`)는 모듈 내부 전용이라 conventions 가 형태를 규정하는
표면(API endpoint·DTO·Redis 키·에러 코드)에 해당하지 않는다.

## 위험도

NONE
