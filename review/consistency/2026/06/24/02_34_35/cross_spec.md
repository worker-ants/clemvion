# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (5-admin-console.md 중심 + 관련 6개 파일)
검토 모드: --impl-done, diff-base=origin/main
검토 일자: 2026-06-24

---

## 발견사항

### [CRITICAL] NAV-WC-04 요구사항 ID 가 "백엔드 미저장" 로 선언된 채 ✅ 표기 — 5-admin-console.md §4·§R2 의 "서버 저장" 결정과 직접 모순

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §4`, `§R2`, `_product-overview.md §2 비목표 주석`
- **충돌 대상**: `spec/2-navigation/_product-overview.md` 217–222 행 NAV-WC-04
- **상세**:
  - `spec/2-navigation/_product-overview.md` NAV-WC-04 는 `"외형/콘텐츠 빌더 (BootConfig 필드, 백엔드 미저장 — boot 옵션으로만 emit)"` 로 정의되어 있으며 상태가 `✅`(구현 완료)로 표시된다.
  - `spec/7-channel-web-chat/5-admin-console.md §4` 는 "저장 시 트리거의 `config.interaction.appearance` 로 영속화한다 (`PATCH /api/triggers/:id`)" 라고 정의하며, `§R2` 는 이 결정이 "2026-06-24 결정으로 기존 미저장 결정을 부분 번복"한 것임을 명시한다.
  - `_product-overview.md §2` 비목표 주석도 "결정 2026-06-24"를 인라인으로 달고 있어 번복을 인지하지만, NAV-WC-04 행 자체는 "백엔드 미저장" 문구 그대로이고 상태가 여전히 `✅`다.
  - 결과: NAV-WC-04 는 기존 결정("미저장")을 근거로 ✅ 처리됐으나 그 결정이 번복됐으므로, 두 문서 중 하나가 구현·계약을 잘못 기술하고 있다. 구현 diff 에서는 `PATCH /api/triggers/:id`에 `appearance` 포함이 실제 코드 경로로 존재한다(`interaction-config.dto.ts` + `mergeExternalConfig`).
- **제안**: `spec/2-navigation/_product-overview.md` NAV-WC-04 를 `"외형/콘텐츠 빌더 (BootConfig 필드, 인스턴스 단위 서버 저장 `config.interaction.appearance` — 결정 2026-06-24)"` 로 갱신하고 상태를 정합 확인 후 재표기한다.

---

### [WARNING] EIA §4 POST 등록 페이로드에 `authType` 인라인 필드가 예시로 남아 있음 — V066 cleanup 과 충돌

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §2` 표 (EIA §4 참조)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §4` POST 페이로드 예시 (`"authType": "bearer"`), `spec/2-navigation/2-trigger-list.md §3 Rationale R-14`
- **상세**:
  - EIA §4 POST 예시(`spec/5-system/14-external-interaction-api.md` line ~169)에는 `"authType": "bearer"` 가 남아 있다.
  - `spec/2-navigation/2-trigger-list.md` R-14 와 `spec/5-system/14-external-interaction-api.md §7.1` 본문은 "inline 인증 필드(`authType`/`hmacHeader`/`hmacSecret`/`bearerToken`)는 V066 cleanup 으로 폐기됐고 `authConfigId` FK 모델로 일원화됐다"고 명시한다.
  - 5-admin-console §2 의 POST 본문(`{ type:'webhook', workflowId, name, endpointPath, interaction:{...} }`)은 `authType` 을 포함하지 않아 실제 구현·spec 본문과 정합하지만, EIA §4 예시 코드 블록의 잔류 `authType` 필드가 혼동 소지를 준다.
  - 5-admin-console 자체는 직접 충돌하지 않으나, 이를 인용하는 구현자가 EIA §4 예시를 보고 `authType` 을 포함할 위험이 있다.
- **제안**: `spec/5-system/14-external-interaction-api.md §4` POST 예시에서 `"authType": "bearer"` 행을 제거하고 `"authConfigId": null` (공개 위젯 기본) 형태의 주석으로 교체하거나, 폐기 명시 주석을 추가한다.

---

### [WARNING] `spec/2-navigation/_product-overview.md` NAV-WC-04 상태 `✅` — 외형 서버 저장 구현이 diff 에 있으나 NAV-WC-04 요구 조건("미저장")이 번복됐으므로 완료 판정 자체가 부정확

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §4`·구현 diff (`PATCH /api/triggers/:id` + `WebChatAppearanceDto`)
- **충돌 대상**: `spec/2-navigation/_product-overview.md` NAV-WC-04 (`백엔드 미저장`, `✅`)
- **상세**:
  - 위 CRITICAL 발견사항의 파생 경고다. NAV-WC-04 가 "미저장" 문구로 ✅ 처리된 이후 외형 서버 저장이 결정·구현됐으므로, 현재 구현은 NAV-WC-04 의 **원래 요건을 초과** 한 상태다.
  - 이는 plan/review 흐름에서 요구사항 추적을 흐리게 한다 — ✅ 는 "미저장 variant 가 구현됐다"는 의미가 되어 버리고 실제 구현("서버 저장")과 다르다.
- **제안**: CRITICAL 발견사항과 동일 수정으로 해소된다. NAV-WC-04 요건 정의 갱신 시 상태 재표기 필요.

---

### [WARNING] EIA §4 POST 페이로드에 `appearance` 서브필드가 미정의 — 5-admin-console §2 PATCH 에 `appearance` 가 추가됨

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §2` (PATCH에 `interaction:{ enabled, tokenStrategy, appearance }` 명시), `§4`, `§R2`
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §4` interaction config 스키마 (`{ enabled, tokenStrategy }` 2개 필드)
- **상세**:
  - EIA §4 의 `interaction` 객체 정의는 `{ enabled: bool, tokenStrategy: "per_execution"|"per_trigger" }` 두 필드만 명시한다.
  - 5-admin-console §2 는 PATCH 에 `interaction:{ enabled, tokenStrategy, appearance }` 를 명시하고, §4 는 `config.interaction.appearance` 에 서버 저장함을 규정한다. `WebChatAppearanceDto` 가 실제 DTO 로 도입됐다.
  - EIA spec 은 interaction config 스키마가 확장됐음을 전혀 언급하지 않는다. EIA §4 를 보는 개발자는 `appearance` 필드의 존재를 알 수 없고, 해당 DTO 제약(enum/hex/길이 검증)도 추적할 수 없다.
- **제안**: `spec/5-system/14-external-interaction-api.md §4`(또는 §7.1 Trigger 엔티티 확장) 에 `appearance` 옵셔널 서브객체를 추가하고 `WebChatAppearanceDto` 를 SoT 로 참조 링크한다. 또는 5-admin-console §4 에 "EIA §4 스키마 확장은 별도 갱신 필요(TODO)" 명시.

---

### [INFO] `spec/0-overview.md §6.2` 웹채팅 설명이 "라이브 미리보기는 위젯 co-deploy 후 증분 2"로 기술 — 구현 diff 에는 co-deploy 파이프라인(copy-widget.mjs)이 포함됨

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §6`·구현 diff (copy-widget.mjs, `build:widget`)
- **충돌 대상**: `spec/0-overview.md §6.2` 임베드형 웹채팅 위젯 + SDK 항목
- **상세**:
  - `spec/0-overview.md §6.2` 는 "운영 콘솔(사이드바 '웹채팅' 메뉴 `/web-chat` — 인스턴스 생성·외형 빌더·설치 스니펫 구현 완료, **라이브 미리보기는 위젯 co-deploy 후 증분 2**)"로 기술한다.
  - 구현 diff 에는 `copy-widget.mjs`, `package.json build:widget`, `frontend/README.md` co-deploy 설명이 포함되어 있어, co-deploy 파이프라인 자체는 본 PR 범위에 포함된 것으로 보인다. 단 `5-admin-console.md §6` 에서도 "선행조건 = 위젯 동봉(co-deploy)"이라고 명시하며 co-deploy 가 증분 2 선행조건임을 동일하게 기술한다.
  - 이는 충돌보다는 **동기화 권장** 수준이다 — co-deploy 파이프라인 구현이 완료됐다면 `0-overview.md §6.2` 의 상태 기술과 "증분 2" 표기를 재검토해야 한다.
- **제안**: co-deploy 파이프라인(copy-widget.mjs)이 이번 증분에 포함되었으면 `spec/0-overview.md §6.2` 의 상태 기술을 갱신한다. 미리보기 UI 자체가 증분 2 대상이라면 현행 기술이 정확하므로 변경 불필요 — 판단 후 결정.

---

### [INFO] `spec/2-navigation/_product-overview.md` NAV-WC-06 상태 `🚧` — 라이브 미리보기 iframe 구조는 이미 5-admin-console §6 에 완전 정의됨

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §6`
- **충돌 대상**: `spec/2-navigation/_product-overview.md` NAV-WC-06
- **상세**:
  - NAV-WC-06 은 `🚧 (증분 2 — 위젯 co-deploy 후)` 상태다.
  - `5-admin-console.md §6` 은 라이브 미리보기의 boot config 전달 메커니즘, same-origin iframe 로드, `wc:ready`/`wc:boot` 프로토콜, 외형 폼 재전송, 임베드 soft 검증 관계 등을 모두 상세 기술하고 있다.
  - spec 상태는 구현(코드) 완료 여부를 나타내는 것이므로, spec 정의 완료 ≠ 구현 완료다. 하지만 spec 기술과 NAV-WC-06 `🚧` 표기의 일관성을 위해 "spec 정의 완료, 구현 보류(위젯 co-deploy 선행)" 로 명시하면 더 명확하다.
- **제안**: NAV-WC-06 상태 설명을 `🚧 (spec 완료, 구현은 위젯 co-deploy 선행 필요)` 로 명확화 — 의무적 변경은 아님.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 의 핵심 변경(외형 서버 저장, co-deploy 파이프라인, 라이브 미리보기 프로토콜)은 영역 내부에서 잘 자기정합적으로 기술되어 있다. 그러나 `spec/2-navigation/_product-overview.md` NAV-WC-04 가 "백엔드 미저장" 정의로 남아 있으면서 ✅ 처리된 것은 2026-06-24 결정(부분 번복)과 직접 모순되는 CRITICAL 이슈다 — NAV-WC-04 의 요건 자체가 번복됐으므로 요건 정의 갱신이 필요하다. EIA §4 의 `appearance` 필드 미정의(WARNING)와 `authType` 잔류 예시(WARNING)는 spec 영역 간 동기화 부채이며, 구현 오염을 유발할 수 있다. INFO 항목 두 건은 현재 충돌보다 명확화·동기화 권장 수준이다.

## 위험도

**HIGH**

(CRITICAL 1건: NAV-WC-04 요건 정의가 번복된 결정과 직접 모순. WARNING 2건: EIA 스키마 동기화 미완. 구현 자체는 영역 내 spec 과 정합하나 상위 요구사항 트래킹 신뢰성 훼손.)
