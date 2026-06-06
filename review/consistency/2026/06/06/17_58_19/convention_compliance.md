# Convention Compliance Review

**Target**: `spec/5-system/4-execution-engine.md`
**Mode**: 구현 착수 전 검토 (`--impl-prep`)
**Date**: 2026-06-06

---

## 발견사항

### [INFO] `## Overview` 섹션 부재 — 3섹션 구조 미완
- **target 위치**: 파일 전체 구조 (§1 ~ §11 + Rationale)
- **위반 규약**: `CLAUDE.md` "정보 저장 위치" — spec 문서에 `## Overview` / 본문 / `## Rationale` 3섹션 권장 구조. `spec/conventions/spec-impl-evidence.md §Overview` 예시도 동일 패턴 채택.
- **상세**: 이 문서는 `## Rationale` 절을 갖추고 있으나 `## Overview` 섹션이 없다. §1~§11이 곧 본문이며 진입 헤더(`# Spec: 실행 엔진 상세`) 이후 바로 본문(`## 1. 실행 상태 머신`)으로 들어간다. 기술 명세 성격의 문서이므로 관련 문서 링크 블록(`> 관련 문서:`)이 최상위에 있어 진입 역할을 일부 수행하고 있으나 공식 `## Overview` 절은 없다.
- **제안**: 해당 문서는 기술 명세(코드·알고리즘 중심)이므로 `## Overview` 섹션 부재가 기능상 문제를 일으키지 않는다. 규약은 "권장"으로 표현되며 `CLAUDE.md`에서 "각 SKILL.md 참고"라 명시해 강제가 아닌 가이드라인이다. 규약 자체가 기술 명세 문서의 면제를 별도로 선언하지 않으므로 INFO 수준으로 기록.

---

### [INFO] `pending_plans` 항목 `exec-park-durable-resume.md` — 본문 내 "구현 완료" 서술과 상태 불일치
- **target 위치**: frontmatter `pending_plans` 4번 항목 + 본문 §4.x, §7.5, §Rationale "park 즉시 해제 + slow-path 일원화"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 의 `pending_plans:` 는 아직 미완인 plan 경로. §3.1 전이 규칙: "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 `implemented` 로 승격 의무".
- **상세**: 본문 §4.x "구현 메모 (Phase B, 구현 완료)" 및 §Rationale "PR-B2b … 구현 완료 — 2026-06-06" 주석에서 `exec-park-durable-resume` plan의 전체 범위(PR-B1+B2a+B2b, full B3)가 완료됐다고 명시한다. 그러나 frontmatter에 해당 plan이 `pending_plans`로 여전히 열거돼 있으며, plan 파일(`plan/in-progress/exec-park-durable-resume.md`)도 `plan/complete/`로 이동되지 않았다. `spec-impl-evidence.md §3` 에 따르면 완료된 plan은 `complete/`로 이동하고 spec의 `pending_plans`에서 제거되어야 하며, 모든 `pending_plans`가 완료되면 `status` 자체를 `implemented`로 승격해야 한다.
- **제안**: `plan/in-progress/exec-park-durable-resume.md`를 `plan/complete/`로 이동하고 frontmatter의 `pending_plans`에서 해당 항목을 제거한다. 나머지 3개 plan(`execution-engine-residual-gaps`, `spec-sync-execution-engine-gaps`, `exec-intake-queue-impl`)이 여전히 미완이므로 `status: partial`은 적절히 유지된다. Build-time 가드(`spec-status-lifecycle.test.ts` (c) 규칙)가 이미 이를 플래그할 수 있다.

---

### [INFO] `INVALID_EXECUTION_STATE` — WS vs REST 이름 분리의 에러 코드 규약 교차 언급
- **target 위치**: §7.5.1, §Rationale "Phase 2 cont 후속 정리 §2"
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드는 "조건의 의미"를 기술해야 하며 구현 맥락(WS vs REST)을 이름에 박지 않음.
- **상세**: 문서 자체가 WS 쪽 `INVALID_EXECUTION_STATE`와 REST 쪽 `INVALID_STATE`를 의도적으로 분리한 결정을 기술하고 있고, 그 이유(routing 분기 인지 용이성)가 명확히 서술돼 있다. `error-codes.md §2`의 "의미가 분기되거나 새 조건이 생기면 신설" 정책과는 다르게, 이 두 코드는 동일 조건을 다른 프로토콜 layer에서 표현하는 구조다. `error-codes.md`의 "단일 진실" 소유 범위(명명 규율)와 비교하면 규약 자체를 갱신해야 하는지 검토가 필요하다.
- **제안**: 현재 운영 코드 경로가 이 분리를 의도적으로 채택한 것이고 `error-codes.md`의 historical-artifact 레지스트리(§3)에 이 케이스가 미등재되어 있다. 규약 위반은 아니나, `error-codes.md §3` 레지스트리에 "동일 의미를 WS/REST 다른 코드로 표현하는 layer-routing 패턴"으로 등재하면 향후 유사 케이스의 선례가 명확해진다. 현재로서는 INFO 수준.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)를 `spec/conventions/spec-impl-evidence.md §2` 규약에 따라 올바르게 구성하고 있으며, `code:` glob이 실존하고 `pending_plans` 파일들이 `plan/in-progress/`에 실재한다. Redis 키 네이밍, 에러 코드 표기(`UPPER_SNAKE_CASE`), NodeHandlerOutput 5필드 구조, Rationale 절 구비 등 주요 정식 규약 조항은 준수됐다. 발견된 세 건은 모두 INFO 수준으로, 의도적 설계 결정(WS/REST 코드 분리, 기술 명세의 Overview 절 생략)이거나 구현 완료 선언 후 plan 파일 이동·frontmatter 갱신을 누락한 프로세스 이슈(`exec-park-durable-resume` pending_plans 잔류)다. 후자는 build-time 가드(`spec-status-lifecycle.test.ts`)가 포착할 수 있으므로 착수 차단 사유는 없다.

## 위험도

LOW

STATUS: OK
