---
worktree: trigger-endpoint-immutable-f81770
started: 2026-06-28
owner: developer
spec_impact: none
---

# Trigger endpoint_path — ai-review 이월 항목 처리 (PR #738 후속)

> 출처: `review/code/2026/06/27/21_37_31/SUMMARY.md` (PR #738 — trigger endpointPath v4 UUID 강제)
> 대상: W3(WARNING #3) + INFO #3 / #9 / #11

## 배경

PR #738 의 ai-review SUMMARY 가 남긴 4개 이월 항목을 처리한다.

## W3 — "UpdateTriggerDto leaky abstraction" 은 오탐 (전제 뒤집힘)

SUMMARY W3 는 "UpdateTriggerDto 가 endpointPath 를 받지만 service 가 거부한다 →
누출 추상화" 로 봤으나, **코드 확인 결과 전제가 틀렸다**:

- `triggers.service.ts:226` 의 `disallowed.push('endpointPath')` 는
  **`if (trigger.type === 'schedule')` 블록 내부** — schedule 타입만 거부.
  webhook 타입은 `Object.assign`(259줄)으로 endpointPath 변경을 **정상 적용**한다.
- 프론트 `webhook-config-card.tsx:57-58` 에 endpointPath **편집 UI 가 정식 존재**하며
  변경 시 `window.confirm` 경고(i18n `endpointPathChangeWarning`:
  "엔드포인트를 변경하면 기존 URL 이 더 이상 동작하지 않아요") 후 PATCH 전송. (#674 부터 출하)
- spec **WH-MG-02** 가 "서버가 **생성/수정 DTO** 에서 v4 UUID 형식을 강제" 라고 명시 —
  spec 자체가 endpointPath 를 update DTO 에 두는 것을 전제로 한다.

→ 즉 webhook endpointPath 는 **의도적으로 mutable** 인 출하된 기능이다.
옵션 A(필드 제거)·B(ENDPOINT_PATH_IMMUTABLE throw)는 둘 다 이 기능을 **삭제**하고
WH-MG-02 와 충돌하므로 부적절.

**채택: 옵션 C — 거짓 JSDoc 정정 (mutable 유지)**. 리뷰어를 오도한 진짜 결함은
`update-trigger.dto.ts:51-52` 의 거짓 주석("생성 후 endpointPath 변경은 service 가
거부한다")이다. webhook 은 편집 가능(기존 URL 404 주의)·schedule 만 거부로 정정.
사용자 결정(2026-06-28): C.

## INFO #3 — endpoint_path DB CHECK 제약 (NOT VALID)

PR #738 이전 endpoint_path 는 free-form(`@IsString/@MaxLength(255)`, docs 예시
`"uuid-or-slug"`)이라 레거시 row 가 비-UUID 일 수 있다. 운영 DB 사전 조회 불가하므로
`ADD CONSTRAINT ... CHECK (endpoint_path IS NULL OR <v4-uuid>) NOT VALID` 로 추가 —
신규 write 만 강제, 기존 row 미검증(배포 안전). NULL 허용(schedule/manual). 사용자
결정(2026-06-28): NOT VALID. 후속: 운영 클린 확인 후 `VALIDATE CONSTRAINT` 승격 가능.

## INFO #9 / #11 — 테스트 보강

- #9: `trigger-dto-validation.spec.ts` 에 v5 UUID 거부 케이스 (기존 v1 거부 케이스 대칭).
- #11: `webhook-trigger.e2e-spec.ts` 에 비-UUID endpointPath → 400 VALIDATION_ERROR.

## 부수 발견 — stale base 로 인한 기존 회귀 2건 (rebase 로 해소)

worktree 가 stale origin/main(e6754f4cb, #738 직후·후속 fix 이전)에서 분기돼 아래 2건이
내 변경과 무관하게 red 였다. 둘 다 **현재 origin/main(b9acf02c7) 에 이미 수정 존재** —
`git rebase origin/main` 으로 해소(내가 별도 fix 하지 않음):

- Gate C: `plan/complete/trigger-review-deferred-fixes.md` frontmatter `spec_impact` 누락
  (메모리 feedback_spec_impact_gate_c_list). origin/main 이 동일 4-spec 리스트로 이미 등록.
- system-status e2e:110: 런타임은 `workspace-invitations-pruner` 큐(#738) 등록하나 stale
  base 의 `EXPECTED_QUEUE_NAMES` 가 그것을 누락. origin/main 이 이미 추가.

## 체크리스트

- [x] (W3) `update-trigger.dto.ts` JSDoc 정정 (mutable 유지)
- [x] (INFO #3) `V102__trigger_endpoint_path_uuid_check.sql` migration 추가 (NOT VALID)
- [x] (INFO #9) v5 UUID 거부 unit 테스트
- [x] (INFO #11) 비-UUID endpointPath 400 e2e 테스트
- [x] (fixture) 직접 INSERT e2e 픽스처 endpoint_path → UUID (chat-channel-fixture, external-interaction)
- [x] stale base 회귀 2건(Gate C·system-status) → rebase origin/main 으로 해소
- [x] TEST: lint PASS · unit PASS (rebase 후 재수행 필요)
- [ ] TEST: build · e2e (rebase 후)
- [ ] `/ai-review` + SUMMARY
- [ ] `/consistency-check --impl-done` (spec 연결 코드 — BLOCK: NO)
