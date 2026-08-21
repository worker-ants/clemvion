# Rationale 연속성 검토 — masked-marker-shared-package.md

## 검토 방법

target(`plan/in-progress/masked-marker-shared-package.md`)과 bundle 된
`spec/5-system/14-external-interaction-api.md` `## Rationale`(R1~R19, 특히 마스킹 관련
R17)을 대조했다. 또한 target 자신이 "PR #1189 의 이월 항목" · "`git log -S
"MASKED_MARKERS"` 상 추출이 기각된 이력은 없다" 라고 주장하므로, 이 주장 자체를
`git log`·실제 소스(`sanitize-error-message.ts`/`websocket.service.ts`)·
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커로 직접 검증했다.

## 발견사항

- **[WARNING]** R17 "backend 가 SoT" 문구가 추출 후 물리적으로 낡는다 — 갱신 작업이 체크리스트에 없음
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` §"작업"(L80-90), 특히 L85-87
    (`sanitize-error-message.ts`/`masked-markers.ts` → 패키지 import 후 **재export 유지**)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17 "프리필 왕복" 절
    — *"마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다 —
    어긋나면 가드가 조용히 뚫리므로 **양쪽을 함께** 갱신한다."*
  - 상세: target 이 완료되면 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/
    `MASKED_MARKERS`/`isMaskedMarker`/깊이 상한의 실제 정의는 `codebase/packages/
    masked-markers/`로 이동하고, backend `sanitize-error-message.ts` 는 재export shim 이
    된다. import 경로 하위호환은 유지되므로 소비처 관점에서는 깨지지 않지만, "backend
    파일이 SoT" 라는 R17 의 문장은 문자 그대로는 더 이상 참이 아니다(물리적 SoT는
    패키지, backend/frontend 는 동일 재export). 이 spec 문서는 정확히 이런 종류의
    "물리적 위치 drift" 를 여러 번 겪었고 그때마다 명시적 날짜 붙은 정정을 남겼다
    (R12 "2026-08-17 출처 정정", R14 "2026-08-11 범위 명확화", R17 자체의 반복된
    "~~잔여~~ 해소"/"정정" 패턴). target 의 "작업" 체크리스트(L80-90)에는
    `/consistency-check --impl-prep` 와 spec 파일 자체를 건드리는 항목이 없고,
    `spec_impact`(frontmatter L5-6)만 문서를 지목할 뿐 R17 문구 갱신을 명시하지 않는다.
  - 제안: "작업" 목록에 R17 "프리필 왕복" 절의 SoT 문장에 대한 짧은 addendum 을
    추가 — 예: *"(2026-08-21 정정) 마커 집합의 물리적 정의는 `@workflow/masked-markers`
    로 이동했다. `sanitize-error-message.ts`/`masked-markers.ts` 는 하위호환 재export
    이며 import 경로·거동은 불변. '양쪽을 함께 갱신' 의무는 이제 구조적으로 불필요
    (단일 정의)."* `--impl-prep` 게이트가 이 갭을 자동으로 잡을 가능성이 있어 CRITICAL
    까지는 아니나, target 문서 자체에 명시가 없으면 impl 단계에서 누락될 수 있다.

- **[INFO]** 관련 tracker 항목 2건을 닫는 작업이 target 체크리스트에 없음
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` L11-12(도입부),
    "작업" 섹션(L80-90) 전체
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    L373-382("마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게
    한다", 2026-08-17 등재) 및 L757-760("마커 리터럴 cross-stack 계약 테스트 부재",
    2026-08-21 등재, PR #1189 라운드에서 재등록)
  - 상세: 두 tracker 항목이 지금 target 이 풀려는 갭과 동일 실체다. 특히 L373-382 항목은
    이미 *"두 스택을 가로지르는 대조. backend jest 와 frontend vitest 가 갈려 있어
    공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로 남긴다"* 라고
    적어, target 의 "계약 테스트보다 추출" 결론을 **사전에 예견·권고**해 두었다 —
    즉 target 은 기각된 대안을 되살리는 게 아니라 이미 트래커에 적힌 권고를 이행하는
    쪽이다(이 부분은 문제없음, 오히려 근거가 실측보다 강하다). 다만 target 은 완료 시
    이 두 체크박스를 `[x]` 로 닫는 작업을 명시하지 않는다. 이 저장소는 최근
    (`b355798da` "이월 항목이 실제로는 어디에도 없었다")에 바로 이 실패 형태
    — RESOLUTION 에 "트래커로 넘긴다" 적어 놓고 실제로는 어디에도 안 적히는 것 — 를
    겪었으므로, 역방향(트래커에는 있는데 완료 후 안 닫히는 것)도 같은 리스크군이다.
  - 제안: "작업" 체크리스트 끝에 `spec-sync-external-interaction-api-gaps.md` L373·L757
    두 항목을 `[x]` 로 갱신하는 항목을 추가.

## 확인했으나 문제 없음(참고용 — 재확인 노력 낭비 방지)

- `git log --oneline --all -S "MASKED_MARKERS"` 및 `-i --grep` 실행 결과, "공유 패키지
  추출"을 명시적으로 기각한 이력은 없음을 확인 — target L36-37 의 주장은 사실과 부합.
  오히려 위 INFO 항목에서 보듯 추출은 **사전에 권고**된 경로였다.
- `@workflow/ai-end-reason`(target L31-34) 인용은 실제 `codebase/packages/ai-end-reason/
  package.json`·`README.md` 문구와 정확히 일치 — 지어낸 선례 아님.
- `MAX_REDACT_DEPTH`(`depth >= 10`, `sanitize-error-message.ts:112,260`) vs
  `MAX_SANITIZE_DEPTH`(`depth > 10`, `websocket.service.ts:80,119`) 의 연산자·깊이 차이는
  실제 소스와 기존 코드 주석(`strip-external-only-fields.ts` 의 비교 표)에서도 동일하게
  기술돼 있어 target L50-64 의 "다른 불변식이므로 건드리지 않는다" 판단은 근거가
  정확하고, "공유 프리미티브를 넓히면 무관한 경로가 오염된다" 원칙(§9.3 R15 인접 문맥,
  #1189 라운드 반복 학습)을 올바르게 적용한 사례다 — 위반이 아니라 준수.
- `internal-package-registration.test.ts`(target L69) 는 실제로
  `codebase/frontend/src/lib/repo-guards/__tests__/`에 존재하며, `.claude/test-stages.sh`
  의 `INTERNAL_PACKAGES` 배열도 실재 — 등록 표면 근거가 지어낸 것이 아님.

## 요약

target 은 "MASKED_MARKERS 크로스런타임 동기화 테스트 부재"를 계약 테스트가 아니라 공유
패키지 추출로 해소하기로 결정했는데, 이는 spec R17 의 어떤 항목도 기각한 적 없는 방향이며
오히려 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 2026-08-17 시점에
이미 "패키지 추출이 선행돼야 계약 테스트가 싸진다"고 예견해 둔 경로를 이행하는 것이다.
`MAX_SANITIZE_DEPTH`를 분리 유지하기로 한 판단도 "공유 프리미티브를 넓히면 무관한 경로가
오염된다"는 이 시리즈의 반복 학습 원칙을 정확히 따른다. 유일한 실질 리스크는 추출이
완료되면 R17 의 "backend `sanitize-error-message.ts` 가 SoT" 문구가 물리적으로 낡는데,
이 문서 특유의 "출처 정정" 관행에 맞는 명시적 갱신 작업이 target 체크리스트에 없다는 점
(WARNING)과, 관련 tracker 체크박스 2건을 닫는 절차가 빠져 있다는 점(INFO) 뿐이다. 둘 다
설계·결정 자체의 충돌이 아니라 문서 동기화 누락 위험이다.

## 위험도

LOW
