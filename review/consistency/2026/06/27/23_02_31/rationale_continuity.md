STATUS: OK

# Rationale 연속성 검토 결과

검토 모드: --impl-done  
Scope: `spec/5-system/`  
Diff base: `acfa6735b1e426f73f5965bf9272aa88a2a7aafd`

변경된 spec 파일:
- `spec/5-system/12-webhook.md` (WH-SC-01, WH-MG-02 단순화)
- `spec/data-flow/0-overview.md` (큐 카탈로그 17→16개)
- `spec/data-flow/10-triggers.md` (Rationale 수정 — 서버 UUID 미강제 반영)
- `spec/data-flow/12-workspace.md` (pruner 미구현 상태 반영)

---

## 발견사항

### [WARNING] WH-SC-01/WH-MG-02 — 보안 강제 요구사항 de-specification, 12-webhook.md Rationale 신규 항목 부재

- **target 위치**: `spec/5-system/12-webhook.md` WH-SC-01 행 및 WH-MG-02 행
- **과거 결정 출처**: 동 파일 구 WH-SC-01·WH-MG-02 본문; `spec/2-navigation/2-trigger-list.md` Rationale R-15 (capability token 모델 cross-reference)

**상세**

구 WH-SC-01: "endpointPath UUID 가 사실상 비밀 키이므로 **반드시 CSPRNG 로 발급한 v4 UUID** 여야 한다(`crypto.randomUUID()`). 서버는 형식(v4)을 강제(WH-MG-02)하나 엔트로피 품질까지 검증할 수 없으므로, 클라이언트는 약한 RNG·고정값 사용을 금한다."  
신규 WH-SC-01: "endpointPath UUID 가 사실상 비밀 키"

구 WH-MG-02: "클라이언트가 `crypto.randomUUID()` 로 발급하고 **서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제**(`@IsUUID('4')`)해 예측 가능 경로 직접 지정을 차단한다 (WH-SC-01 비밀성 보강)."  
신규 WH-MG-02: "생성 시 endpoint_path 자동 생성 (랜덤 UUID 기반)"

구현 확인 결과: 백엔드 `/Volumes/project/private/clemvion/codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts`의 `endpointPath` 필드는 `@IsString()` + `@MaxLength(255)` 를 사용하며 `@IsUUID('4')` 가 없다. 서버 측 v4 UUID 형식 강제는 원래부터 구현되지 않았다. 프론트엔드 `triggers/page.tsx:273`은 `crypto.randomUUID()` 를 유지하나 이는 UI 레이어의 선택이며 서버 검증이 뒷받침하지 않는다.

`plan/in-progress/trigger-review-deferred-fixes.md`의 **W1 (보안, 미해소)** 항목이 "서버 강제 발급 또는 DTO `@IsUUID(4)` 검증"을 요구사항으로 추적 중이다. 즉 이 변경은 보안 갭이 해소된 이후 spec 반영이 아니라, 미해소 갭 상태에서 spec이 구현 현황에 맞춰 후퇴한 것이다.

`spec/data-flow/10-triggers.md` Rationale의 "Webhook `endpoint_path` 의 UNIQUE 범위" 항은 "서버는 UUID 형식을 강제하지 않는다"는 사실을 기술했으나, 이는 (a) 12-webhook.md의 Rationale 섹션이 아니며, (b) 클라이언트 CSPRNG 요건을 제거한 이유, 서버 측 강제 미구현을 의도적으로 수용한 사유, plan W1 이슈와의 관계를 설명하지 않는다.

`spec/5-system/12-webhook.md` Rationale 섹션 (현재 "webhook URL base 결정 규약", "외부 인터랙션 채널 분리", "Chat Channel 어댑터 분리", "inline auth path 폐지" 4개 항)에 이 결정에 관한 항목이 없다.

**제안**: `spec/5-system/12-webhook.md` Rationale에 신규 항목 추가:
1. 서버 측 `@IsUUID('4')` 미구현을 수용한 이유(또는 defer 결정 및 plan W1 참조)
2. WH-SC-01의 CSPRNG "반드시(MUST)" 요건이 spec에서 완화된 배경 — "capability token으로서 endpointPath의 보안성은 클라이언트 `crypto.randomUUID()` 에만 의존한다"는 현 설계 한계 명시
3. 해소 방향 (서버 발급 전환 또는 DTO 검증 도입 검토 예정임을 plan W1로 연결)

---

### [INFO] WorkspaceInvitationsPrunerService 제거 — data-flow/12-workspace.md Rationale 항목 부재

- **target 위치**: `spec/data-flow/12-workspace.md` §1.2·§3.1·§3.2 의존성 표; `spec/data-flow/0-overview.md` §4 큐 카탈로그
- **과거 결정 출처**: 동 파일 구 §1.2 "만료 초대 정리(data 위생)" 항

**상세**

구 `spec/data-flow/12-workspace.md` §1.2: "만료(`expires_at < now`)되고 수락되지 않은(`accepted_at IS NULL`) 초대 row 는 매일 04:00 Asia/Seoul 에 BullMQ repeatable 잡(`WorkspaceInvitationsPrunerService`)이 삭제한다."

신규 §1.2: "만료 row 정리용 `WorkspaceInvitationsService.pruneExpired` 가 존재하나(periodic job 용도) **현재 프로덕션 호출자가 없어** 만료 row 는 영구 잔존한다. 정리 job 연결은 미구현."

구현 확인: diff 범위에서 `workspace-invitations-pruner.service.ts` + 테스트 파일이 삭제됐고, `workspaces.module.ts`에서 BullMQ 등록·provider 등록이 제거됐다. `pruneExpired` 메서드(`workspace-invitations.service.ts:365`)는 존재하나 호출자가 없다. `plan/in-progress/trigger-review-deferred-fixes.md` **W7 (데이터 위생, 미해소)** 항목이 이를 추적한다.

이 변경은 과거 spec이 "동작하는 pruner" 를 기술했으나 사실상 구현이 없었던 gap을 교정한 spec-sync이다. 합의된 invariant의 직접 위반은 아니다. 다만 spec의 body 텍스트가 현황을 기술하는 데 그쳤고, `spec/data-flow/12-workspace.md` Rationale 섹션에 "pruner를 제거한 이유(범위 외 결정·defer), 만료 초대 영구 잔존이 현 시점에 수용 가능한 이유(토큰 만료 시 기능적으로 이미 무효화됨 — `assertTokenUsable` → 410, §§1.5.4)" 를 기록하는 항목이 없다.

**제안**: `spec/data-flow/12-workspace.md` Rationale에 간략 항목 추가 — pruner BullMQ 연결을 plan W7으로 이관한 사유와, 만료 초대 row 잔존이 기능 정합성(410 응답)에 미치는 영향이 없음을 명시. 큐 카탈로그(0-overview.md §4)에서의 제거는 구현 현황 동기화로 별도 설명 불요.

---

## 요약

diff-base 대비 `spec/5-system/` 및 연관 data-flow 파일의 변경은 (1) WH-SC-01/WH-MG-02에서 CSPRNG 강제 및 서버 UUID 형식 강제 요건을 de-specification한 것, (2) WorkspaceInvitationsPrunerService 제거 반영, (3) 큐 카탈로그 수정의 세 그룹이다. 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. 핵심 우려는 WH-SC-01이 "반드시(MUST)" 로 명시했던 CSPRNG 요건과 WH-MG-02의 서버 UUID 형식 강제가 plan W1 보안 이슈 미해소 상태에서 먼저 de-specification됐으며, `spec/5-system/12-webhook.md` Rationale에 이 결정의 배경이 기록되지 않은 점이다. data-flow/10-triggers.md Rationale이 "서버는 UUID 형식을 강제하지 않는다"는 사실을 부분적으로 기술하지만, 이것만으로는 capability token 보안 모델의 현재 근거와 한계를 명확히 하기 어렵다. pruner 제거는 구현 현황 동기화이나 역시 Rationale 항목이 없다.

## 위험도

MEDIUM
