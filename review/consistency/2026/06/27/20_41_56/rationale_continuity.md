# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/4-security.md`
검토 기준: 제공된 관련 spec Rationale 발췌 (0-architecture, EIA, 0-overview 등)

---

### 발견사항

- **[WARNING]** `allow-same-origin` sandbox 속성 — 아키텍처 §R1 "완전 분리" 원칙과의 긴장 (Rationale 항 미작성)
  - target 위치: `§1 보안 정책 요약` 표의 `iframe sandbox` 행
  - 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md` `## Rationale ### R1` — "iframe 은 CSS·JS·전역변수·storage·쿠키를 완전 분리하고 token/대화를 호스트 스크립트로부터 격리한다"를 iframe 채택 핵심 근거로 명시
  - 상세: target 의 sandbox 정책은 `allow-same-origin` 을 포함하며 inline 으로 "동일 origin 악성 스크립트가 sandbox 를 탈출할 수 있으나, 동봉 위젯은 공급망 무결성이 보장되므로 허용" 이라는 트레이드오프를 설명한다. 그러나 아키텍처 §R1 이 천명한 "쿠키·스토리지 완전 분리"를 `allow-same-origin` 이 명시적으로 약화시키는 점은, same-origin admin console carve-out(아키텍처 §R8)과 별개로 보안 spec 자체의 `## Rationale` 항에서 다뤄야 한다. 현재 이 설계 결정은 요약 표의 셀 주석으로만 처리되고 공식 Rationale 항이 없어, 추후 sandbox 정책 변경 시 과거 결정 근거가 추적 불가하다.
  - 제안: `## Rationale` 에 `R5. iframe sandbox allow-same-origin — 완전 격리 원칙의 한정 적용` 항을 신설해 (a) 아키텍처 §R1의 "완전 분리" 원칙이 cross-origin CDN 배포 기준임을 명시, (b) same-origin 동봉 위젯에서의 쿠키·스토리지 접근 필요성 및 공급망 무결성 전제를 공식 문서화, (c) §R8 carve-out 과의 관계를 정리한다.

- **[INFO]** `embed-config` 엔드포인트 — 인증 webhook(`authConfigId` NOT NULL) 을 `enforce:false` 로 처리하는 결정의 Rationale 미기재
  - target 위치: `§3 임베드 allowlist` → `① 클라이언트 soft 검증` 내 `/embed-config` 엔드포인트 동작 서술
  - 과거 결정 출처: `spec/5-system/12-webhook.md §3.2 WH-SC-01` (인증 webhook 과 공개 webhook 구분 정책)
  - 상세: 인증 webhook (`authConfigId NOT NULL`) 은 임베드 검증 대상이 아니라 서버-to-서버 또는 인증 채널이므로 `{ allowlist:[], enforce:false }` 반환은 설계상 자연스럽다. 그러나 이 동작이 WH-SC-01 의 인증 webhook 정책과 어떻게 정합하는지, 공개 봇 전용 임베드 제어라는 원칙이 어디에 명시적으로 선언됐는지 기존 Rationale 에 없다.
  - 제안: 기존 R2 에 한 문장 추가 — "임베드 제어는 공개 봇(`authConfigId IS NULL`)을 위한 것이며, 인증 webhook 은 서버-to-서버 채널이므로 embed-config 엔드포인트 제어 대상 외다(WH-SC-01 구분 정책과 정합)" 또는 `## Rationale` 에 INFO-level 주석 추가.

- **[INFO]** `interactionAllowedOrigins` 빈 목록의 레이어별 비대칭 동작 — invariant 기록 위치 분산
  - target 위치: `§3` 마지막 blockquote ("빈 목록 의미(레이어별)")
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md §8.5` — "미설정 시 차단" invariant 와 "CDN built-in 상수 항상 허용"
  - 상세: CORS 레이어는 empty → CDN only(secure), 임베드 레이어는 empty → allow-all(soft)이라는 비대칭이 §3 blockquote 에 한 번만 기술된다. EIA §8.5 의 "미설정 시 차단" invariant 와 이 비대칭이 서로 어떻게 정합하는지는 blockquote 설명으로 충분히 파악 가능하나, 이 비대칭 자체가 의도된 설계 결정임을 Rationale 에 명시적으로 기록하면 추후 오해를 줄일 수 있다.
  - 제안: R1 또는 R2 하단에 이 비대칭 동작을 의도된 설계 결정으로 한 줄 기록.

---

### 요약

`spec/7-channel-web-chat/4-security.md` 는 R1~R4 Rationale 항이 잘 구비돼 있으며, CORS 표면 분리·임베드 soft 검증·rate-limit 방식·sanitize allowlist 기각 모두 기존 spec Rationale(아키텍처 §R8, EIA §8.5)과 방향이 일치한다. 다만 `allow-same-origin` sandbox 속성은 아키텍처 §R1 의 "완전 분리" 원칙과 명시적 긴장 관계에 있음에도 공식 Rationale 항 없이 표 셀 주석으로만 처리됐고, 인증 webhook 의 embed-config 제외 결정과 빈 목록의 레이어별 비대칭 동작도 Rationale 기록이 부재하다. 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목은 없으며, 위험은 낮은 수준이다.

### 위험도

LOW
