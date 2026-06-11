# Code Review 처분 (RESOLUTION)

- 리뷰 세션: `review/code/2026/06/12/00_33_33/`
- 대상 범위: `origin/main..HEAD` (audit SoT 위생 — B-1~B-4)
- 위험도: **LOW** / Critical **0** / Warning **8**
- 처분 요약: **수정 5건 (W-1·W-3·W-4·W-5·W-6) · 근거 기각 3건 (W-2·W-7·W-8)**

코드 fix 는 본 RESOLUTION 과 함께 커밋한다. fix 가 리뷰 세션보다 늦으므로
review_guard freshness 충족을 위해 fix 를 postdate 하는 ai-review 1회를 추가
수행한다(라운드 2). 라운드 2 가 Critical 0 / LOW 수렴이면 종결한다.

---

## 수정 (FIXED)

### W-1 — `recordAudit` positional → named options 객체 ✅
`auth-configs.service.ts` `recordAudit(action, workspaceId, userId, resourceId, ipAddress?)`
의 5개 동일-타입(`string`) positional 파라미터는 인자 순서 스왑을 컴파일러가
잡지 못해 감사 주체·대상이 조용히 뒤바뀔 수 있었다. 단일 options 객체
`{ action, workspaceId, userId, resourceId, ipAddress? }` 로 변경 → 호출부 5곳
(create/update/regenerate/remove/reveal)도 named 필드로 갱신. 의도 설명 주석 추가.

### W-3 — `AuditLogsService.record()` best-effort(swallow) 계약 테스트 추가 ✅
검토 중 발견: audit producer 들의 docstring 이 "swallow 는 `audit-logs.service.spec`
에서 검증" 이라 참조하나 **(a) 그 파일명이 실재 파일(`audit-logs.spec.ts`)과
불일치**하고 **(b) swallow 계약 테스트가 어디에도 없었다**(#547 부터의 false claim).
`audit-logs.spec.ts` 에 `record — best-effort (swallow)` describe 신설 —
`repo.save` reject 시 `record()` 가 예외를 삼키고 resolve 하는지 + 정상 경로
기록을 검증. `auth-configs.service.ts` docstring 의 파일명 참조도
`audit-logs.spec` 으로 정정.

### W-4 — integrations `update` 테스트에 `save` 호출 단언 추가 ✅
`update → records integration.updated` 테스트가 `integrationRepo.save` 호출을
검증하지 않아 구현이 저장을 생략해도 통과했다.
`expect(integrationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }))`
추가.

### W-5 — OAuth `reauthorize` audit 미기록 분기 계약 단언 추가 ✅
`integration.reauthorized` 는 non-OAuth reset 전용이고 OAuth 경로는 begin()
위임만 한다는 분기 계약에 회귀 방지 테스트가 없었다. OAuth 케이스에
`expect(auditLogsService.record).not.toHaveBeenCalled()` + 의도 주석 추가.

### W-6 — 읽기 경로 "audit 없음" 계약 명시 ✅
`auth-configs.controller.spec.ts` 전파 describe 의 헤더 주석에 "읽기 핸들러
(findAll/findOne/getUsage)는 audit 대상이 아니며 userId/req.ip 를 받지 않아 전파
계약 자체가 성립하지 않아 범위에서 제외" 를 명시. (전용 테스트 대신 주석 —
읽기 핸들러는 구조상 audit 를 호출하지 않으므로 not-called 단언은 동어반복.)

---

## 근거 기각 (WONTFIX — 본 PR 범위 밖)

### W-2 — `req.ip ?? null` 정규화 → 기각(별건 이월)
`undefined` IP 전파는 **본 PR 이 만든 것이 아니라 #547 이 도입한 controller
패턴**이며, 기존 테스트가 `ipAddress: undefined` 기록을 **명시적으로 허용 계약으로
단언**한다(create "ipAddress 미지정 시에도 기록"). `undefined→null` 은 모든 audit
producer 의 기록 의미를 바꾸는 cross-cutting 결정이고, 인수인계 §범위 밖이
"IP 추출 정책 헬퍼"(`auth-config-webhook-followups.md §2~4`)를 **project-planner
별건**으로 명시했다. 본 위생 PR 에서 행동을 바꾸지 않고 해당 plan 으로 이월.

### W-7 — integrations `update` 무변경 시 `save()` 생략 guard → 기각(pre-existing)
`update()` 의 "변경 없어도 항상 save" 는 **본 PR 이 건드리지 않은 기존 구현**으로
(이번엔 테스트만 신설), 동일 entity 의 idempotent save 라 무해하다. guard 추가는
행동 변경이라 순수 위생 범위를 벗어난다. 신규 회귀 아님 → 기각.

### W-8 — `AuditLogDto.action` description 이중 SoT → 기각(완화책 내장)
description 은 이미 `SoT: AUDIT_ACTIONS const / spec/5-system/1-auth.md §4.1`
포인터를 포함해 권위 출처를 가리킨다. B-3 의 명시 의도는 **사람이 읽는 값군
열거 + 레거시 캐비엇(`re_run_initiated`)** 으로, 이는 const 에서 자동 생성할 수
없다(grouping 산문·레거시 값은 const 밖). 데코레이터 내 `Object.values()` 동적
생성은 평가 순서 취약성을 더하고 레거시 캐비엇을 잃는다. 이중 관리 위험은 SoT
포인터로 완화됨 → 의도된 중복으로 수용.

---

## 검증

- build (`nest build`): PASS
- lint(eslint, no-fix)/prettier(changed files): PASS
- unit(affected 4 suites): 170 passed
- 전체 unit (`jest`): **334 suites / 6628 passed, 1 skipped** (라운드1 6626 → +2 swallow 테스트)
- e2e (`make e2e-test`): **32 suites / 188 passed**
- 라운드 2 ai-review(`review/code/2026/06/12/00_46_57`): **RISK=LOW, Critical 0, Warning 4** — 4건 전부 범위 밖/pre-existing/moot 으로 종결 (해당 세션 RESOLUTION 참조).
