# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 및 방법

- **scope**: `spec/5-system/` — 이번 브랜치의 spec 델타는 여전히 **0개 파일** (`git diff --stat origin/main...HEAD -- spec/` 실측). 코드 전용 PR 이므로 이 자체는 위반이 아니다.
- 본 라운드는 직전 라운드(`review/consistency/2026/09/06/01_13_51`, 위험도 NONE)가 지적한 항목이 처분됐는지, 그리고 그 이후 새로 랜딩한 마지막 커밋(`0de16b488`, 01:38:37)이 `spec/5-system/**`·`spec/conventions/**` 준수에 새 위반을 만들지 않았는지를 확인했다.
- 확인 방법: `git log --format='%h %ad %s' origin/main..HEAD -- codebase/ spec/` 로 01_13_51 이후 신규 커밋 식별 → 1개(`0de16b488`)만 발견 → `git show 0de16b488` 전문 대조. 추가로 `spec/5-system/2-api-convention.md` §5(응답 형식)·§5.4(부재 표현) 전문을 워킹트리 절대경로로 재확인하고, `trigger-response.dto.ts` 의 `workflow` 필드 JSDoc(§5.4 "키 생략형" 주장)을 코드와 대조했다.

## 발견사항

(없음 — CRITICAL/WARNING 급 신규 위반 없음)

## 확인한 준수 근거 (위반 아님 — 교차검증 결과)

- **직전 라운드 INFO#3 (`INTERNAL_ERROR` 한/영 drift) 처분 방식이 규약과 일치**: `0de16b488` 는 이 항목을 spec 수정이 아니라 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추적 항목으로 등재하는 것으로 처분했다. `GlobalExceptionFilter` 의 매핑되지 않은 5xx 제네릭 문구를 건드리면 이 PR 범위를 넘는 전역 영향(모든 미매핑 5xx 문구 변경)이 있기 때문 — spec(`3-error-handling.md` §1.1)은 이미 정확한 한국어 문구를 명시하고 있고, 이번 커밋의 신설 코드(`schedules.controller.ts` `toResponse`)는 그 문구를 문자 그대로 채택했으므로 spec 자체는 위반이 아니다. `developer` 가 spec 을 직접 고치지 않고 plan 트래커로 넘긴 처리는 CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙과 일치한다(이 항목은 spec 자체의 오류가 아니라 code-vs-code drift 이므로 애초에 spec 변경 대상도 아니다).
- **§5.4 "기본형 vs 키 생략" 판정이 실제 코드 변경과 정합**: 이번 커밋이 되돌린 `TriggerDto.workflow` JSDoc 의 "생성 응답에만 없다" 주장은, 이전에는 `chatChannel` 포함 PATCH 재조회 경로(`relations` 미포함)에서 반증되고 있었으나, 이번 커밋이 `relations: ['workflow']` 를 추가해 **주장을 좁히지 않고 구현을 주장에 맞췄다** — `spec/5-system/2-api-convention.md` §5.4 "선언과 실제가 같아야 한다"(검증 층 절)의 요구를 코드 쪽에서 충족시킨 사례로, spec 문면과 모순 없음.
- **`ScheduleDto.trigger` 기본형/키 생략 재확정이 §5.4 정의와 일치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 취소선 정정("`ScheduleDto.trigger`=키 생략" → "§5.4 **기본형**")은 `spec/5-system/2-api-convention.md` §5.4 표(`null`=상시 존재/기본값, 키 생략=present-when-available 두 조건 (a)/(b))의 정의를 정확히 반영한 정정이다. `Schedule.trigger_id` NOT NULL 1:1 + 응답 4경로 전부 채움이라는 근거도 §5.4 "선택 기준" 열의 취지(부재가 정상 경로로 발생하지 않으면 키 생략 부적격)와 부합한다.
- **JSDoc `//`/`/** */` 분리 규약 재확인**: 신규/변경된 `trigger-response.dto.ts`·`triggers.service.ts`·`schedule-trigger-ref.spec.ts` 모두 리뷰 인용·정정 경위는 `//` 에, 소비자용 공개 설명은 `/** */` 에 분리 — `spec/conventions/swagger.md §3` 원칙과 일치 (이전 라운드부터 유지되던 패턴).
- **명명 규약**: 이번 커밋에 신규 식별자 추가 없음(기존 파일 보정 + 신규 스펙 파일 1개 `schedule-trigger-ref.spec.ts` — 기존 `*.spec.ts` 명명 패턴을 그대로 따름). API endpoint·DTO 명명 위반 없음.
- **CHANGELOG.md 갱신은 spec 영역 밖**: `CHANGELOG.md` 는 `spec/**` 가 아니므로 본 검토(정식 규약=spec/conventions) 대상이 아니다. 참고로 이 파일은 보안 공지 성격의 개발 산출물로, spec 문서 구조 규약(Overview/본문/Rationale, `_product-overview.md`, `0-` prefix)의 적용 대상도 아니다.

## 요약

이번 라운드는 `01_13_51`(NONE) 이후 새로 랜딩한 유일한 코드/문서 커밋(`0de16b488`)을 전문 대조했다. 이 커밋은 spec/5-system 을 전혀 건드리지 않았고, CHANGELOG·plan 트래커·테스트 보강·서비스 코드 정정만 포함한다. 직전 라운드가 남긴 유일한 INFO(에러 문구 언어 drift)는 spec 정정이 아니라 plan 트래커 등재로 적절히 처분됐으며(범위 밖 전역 영향이 근거), 나머지 변경(§5.4 기본형/키 생략 재확정, `TriggerDto.workflow` JSDoc-구현 정합화)은 모두 `spec/5-system/2-api-convention.md` §5.4 및 `spec/conventions/swagger.md` 의 기존 규정을 문자 그대로 충족하는 방향으로 코드를 맞춘 것이다. CRITICAL·WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
