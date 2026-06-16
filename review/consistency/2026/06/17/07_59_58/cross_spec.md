# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat, diff-base=origin/main)

---

## 발견사항

### INFO — isolated-vm 지원 범위 표기와 실제 engine floor 간 언어 드리프트
- **target 위치**: diff `codebase/backend/package.json` + 여러 내부 패키지의 `engines.node >=24` 추가
- **충돌 대상**: `spec/4-nodes/5-data/2-code.md` — "isolated-vm 버전은 `node>=22` 를 지원하는 `6.x` 라인을 사용한다 (`7.x` 는 `node>=26` 요구 — Node 26 승급 시 재검토)"
- **상세**: `spec/4-nodes/5-data/2-code.md` 의 해당 문장은 "isolated-vm 라이브러리가 지원하는 Node.js 최소 버전" 을 `>=22` 로 기술한다. 그런데 diff 는 프로젝트 전체 `engines.node` 를 `>=24` 로 상향했다. `PROJECT.md` 는 "내부 앱·내부 packages = `engines.node >=24`" 를 명시적 정책으로 확정하고 있으므로, 실제 충돌은 아니다(24 ⊇ 22). 그러나 코드 노드 spec 이 "`node>=22` 를 지원" 이라고 명시해 놓으면 독자가 "우리 플로어가 22" 로 오독할 수 있다.
- **제안**: `spec/4-nodes/5-data/2-code.md` 의 해당 문장을 "isolated-vm 6.x 라이브러리는 `node>=22` 를 지원하지만, 프로젝트 runtime floor 는 `PROJECT.md` 정책(`>=24`)을 따른다" 식으로 명확히 하면 혼동이 제거된다. 모순이 아니므로 차단 불요, 동기화 권장.

---

## 충돌 없음 확인 (영역별)

### 1. 데이터 모델 충돌
없음. diff 는 의존성 버전 업그레이드(otplib v12→v13, jsdom, @vitejs/plugin-react, @types/node) 와 engine field 추가·jest 설정 수정이며, 엔티티·필드 정의를 변경하지 않는다.

### 2. API 계약 충돌
없음. `otplib` v12→v13 은 내부 TOTP 검증 구현 교체이고 외부 API 시그니처(`POST /api/auth/2fa/setup`, `/api/auth/2fa/verify`, `/api/auth/login/totp` 등)는 변경되지 않는다. `spec/5-system/1-auth.md §1.4.J` 가 이미 "TOTP 발급·검증은 `otplib` (v13 라인) 을 사용한다" 로 명시했고 구현이 이에 부합한다.

### 3. 요구사항 ID 충돌
없음. diff 에 신규 요구사항 ID 가 부여되지 않는다.

### 4. 상태 전이 충돌
없음. TOTP v12→v13 업그레이드는 `verifySync`/`generateSync` functional API 로 교체했고 `window:1` → `epochTolerance:30` 등가 전환으로 허용 오차가 동일하게 유지된다. `spec/5-system/1-auth.md §1.4.J` 에 이미 기록된 설계와 일치한다.

### 5. 권한·RBAC 모델 충돌
없음. 의존성 업그레이드 범위이고 RBAC 규칙을 수정하지 않는다.

### 6. 계층 책임 충돌
없음. `spec/7-channel-web-chat` 은 외부 HTTP consumer 정책(facade 미신설, EIA 재사용)을 유지하며 diff 변경 내용과 무관하다. 외부 SDK(`@workflow/web-chat`) 의 `engines.node >=20` 은 PROJECT.md 의 "외부 배포 SDK = `>=20`(소비자 호환폭 보존)" 정책과 일치한다. 내부 앱(backend, channel-web-chat, 내부 packages) 의 `>=24` 도 동일 정책과 일치한다.

---

## 요약

diff 의 핵심 변경인 otplib v12→v13 업그레이드는 `spec/5-system/1-auth.md §1.4.J` 에 이미 선정된 결정과 완전히 정합하며, `engines.node >=24` 설정은 `PROJECT.md` 의 "내부 앱 floor >=24" 정책과 일치한다. `spec/7-channel-web-chat` 의 아키텍처·데이터 모델·API 계약·상태 머신·RBAC는 다른 spec 영역과 모순이 없다. 유일한 발견은 `spec/4-nodes/5-data/2-code.md` 가 isolated-vm 라이브러리 지원 floor를 `node>=22` 로 표기하고 있어 독자가 프로젝트 runtime floor 로 오독할 수 있다는 언어 드리프트(INFO)뿐이며, 실제 모순이 아니다.

## 위험도

NONE
