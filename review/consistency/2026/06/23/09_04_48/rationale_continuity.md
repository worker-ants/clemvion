# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-web-chat-console.md`
참조 spec Rationale: `spec/7-channel-web-chat/_product-overview.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/7-channel-web-chat/4-security.md`, `spec/7-channel-web-chat/2-sdk.md`, `spec/2-navigation/_layout.md`

---

## 발견사항

### [INFO] 비목표 "위젯 외형 서버사이드 관리 콘솔" 재해석 — 경계 명확화로 처리, 적절함

- target 위치: §1.2 "외형은 boot 옵션으로만 — 비목표와의 정합", §1.2 연속성 노트
- 과거 결정 출처: `spec/7-channel-web-chat/_product-overview.md §2 비목표` — "위젯 외형의 서버사이드 관리 콘솔 — 외형은 v1·v2 모두 로더(boot) 옵션으로만 주입(백엔드 미저장)"
- 상세: target 은 이 비목표를 *번복*하지 않고 "백엔드 저장·서빙 콘솔"은 여전히 비목표, "외형 값을 스니펫에 inline으로 emit하는 빌더"는 별개 범위임을 §1.2 연속성 노트와 §Rationale에서 명확히 구분하고 있다. target 자체가 이 긴장을 인식하고 대응 설명을 작성했다.
- 제안: 이미 적절히 처리됨. `_product-overview §2 비목표` 문구 갱신(§2.2)과 `_product-overview Rationale` 추가(§2.2)를 통해 연속성이 유지되도록 하되, 갱신 시 "백엔드 저장·서빙 콘솔은 비목표 유지, emit-only 스니펫 빌더는 별개" 구분을 명시적으로 기술할 것.

---

### [WARNING] §R8(srcdoc 기각) 적용 범위 — 미리보기 same-origin iframe 예외가 원본 spec Rationale 에 미기재

- target 위치: §1.5 "§R8(srcdoc 기각)과의 정합" 단락
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §2.1` — "`srcdoc`/`about:blank` 자가 생성은 기각 — 그 iframe 은 호스트 origin 을 상속해 cross-origin 격리가 깨진다. 격리를 위해 iframe 은 반드시 다른 origin 의 실제 `src` 여야 한다(§R8)." 및 동 `§R8` Rationale — "loader 가 iframe 생성(클라이언트) + 문서는 정적 cross-origin CDN 자산으로 동적 서버 회피와 격리를 동시에 만족한다."
- 상세: §R8 의 핵심은 (a) srcdoc 자가 생성 금지 + (b) "cross-origin CDN 자산"으로 격리라는 두 요소다. target 의 same-origin 동봉 미리보기는 (a) 는 위반하지 않지만 (b) 의 "cross-origin CDN 자산" 원칙을 의도적으로 따르지 않는 선택이다. target 은 "admin 콘솔 미리보기는 cross-origin 격리가 목적이 아님"이라고 설명하나, 기존 R8 Rationale 문언 자체가 고객 임베드 맥락으로의 적용 범위를 명기하지 않아 미리보기 same-origin iframe 이 R8 위반으로 읽힐 여지가 있다. target 의 설명 논리는 타당하지만, 해당 예외 근거가 원본 spec Rationale(`0-architecture §R8`) 에 기재되지 않으면 미래 독자가 결정 번복으로 오독할 수 있다.
- 제안: `0-architecture §R8` (또는 신규 `5-admin-console §Rationale`)에 "admin 콘솔 내부 미리보기는 고객 임베드와 달리 cross-origin 격리보다 버전 일치·외부 의존 제거가 목적이므로 same-origin 동봉 iframe을 허용하는 예외이며, 고객 임베드 경로(loader+cross-origin iframe)는 그대로 유지됨"을 명시적으로 추가할 것. target §1.5 의 논리를 원본 spec 에 backfill 하는 형태.

---

### [INFO] `NEXT_PUBLIC_WIDGET_CDN_BASE` 신설 — 기존 아키텍처 invariant 와 정합, 신규 Rationale 적절히 작성됨

- target 위치: §1.3 값 출처, §1.5, §2.5
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §4` 플레이스홀더 표, `4-security.md §2.1` (`WEB_CHAT_WIDGET_ORIGINS` 기존 env)
- 상세: 기존 아키텍처는 `<widget-cdn-base>` 를 빌드타임 env 주입으로 정의했으나 admin 프론트엔드용 별도 키는 정의되지 않았다. target 은 이 공백을 `NEXT_PUBLIC_WIDGET_CDN_BASE` 신설로 채우며, 기존 `WEB_CHAT_WIDGET_ORIGINS` 와의 상보관계·기본값=self-origin 정책을 §1.3 Rationale 블록에 명시했다. 기각된 대안(한 변수에 합치는 방안)도 근거와 함께 기술되어 있다.
- 제안: 이미 적절히 처리됨. §2.5 의 `0-architecture §4` 갱신 시 두 env 의 상보관계와 "기본값=self-origin(§1.5 co-deploy)" 을 나란히 등재하면 충분하다.

---

### [INFO] co-deploy/버전잠금 — "floating latest" 기각과 self-origin 기본화, 기존 아키텍처 버전 전략과 정합

- target 위치: §1.5 전체, §2.5 버전 전략 보강
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §4` — "loader.js·위젯 SPA 는 `/web-chat/v1/` major 버전 path 고정(불변 자산)"
- 상세: 기존 spec 은 major path 고정만 정의했고 마이너/패치의 floating/잠금 정책은 미결이었다. target 은 "co-deploy = 제품 릴리스와 같이 빌드·배포, floating latest 아님"으로 마이너/패치 버전 전략을 확정하며 §2.5 에서 `0-architecture §4` 버전 전략 보강을 명시한다. major path 유지와 충돌하지 않는다.
- 제안: 이미 적절히 처리됨.

---

### [INFO] EIA 대화 배선 "미배선(계획)" 주석 정정 — 2-sdk.md Rationale 와의 scope 충돌 없음

- target 위치: §1.4 "EIA 대화 배선은 이미 완료 (M1 경로)" 단락
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §2` — "현 increment 미배선 (계획) — SDK 코어만 구현됐고 @workflow/sdk 는 아직 import 되지 않는다"
- 상세: target 은 이 "미배선" 주석이 M2 BYO-UI headless 경로(SDK 패키지가 @workflow/sdk 재사용) 한정이고, M1 hosted iframe 에서 위젯 SPA(`channel-web-chat`)는 자체 `eia-client.ts`로 이미 EIA를 직접 호출한다고 정정한다. `2-sdk.md §2` 의 문맥("web-chat → @workflow/sdk" 의존 방향)을 읽으면 M2 한정임이 맞지만, spec 문구 자체가 "현 increment 미배선"으로 범위를 명기하지 않아 오독될 수 있다.
- 제안: `2-sdk.md §2` 의 "현 increment 미배선 (계획)" 주석을 "M2 BYO-UI headless 경로 한정 미배선" 으로 명확화하면 target 의 정정과 원본 spec 이 정합된다. target §1.4 에서 이를 정정 근거로 언급하고 있으므로, spec 갱신 시 반영 필요.

---

### [INFO] 트리거 재사용(신규 엔티티 미신설) — `0-architecture §R5` EIA client consumer 원칙 완전 준수

- target 위치: §1.1 전체, §Rationale "트리거 재사용"
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §R5` — "백엔드 변경은 CORS·남용 방어로 억제, EIA 핵심 표면 변경 없음. EIA §R10 의 단일 sink·facade 계층에 새 listener 를 추가하지 않는다."
- 상세: target 은 "신규 백엔드 트리거 유형·facade·in-process 우회를 추가하지 않는다"를 명시하며 R5 원칙을 준수한다. 콘솔은 기존 trigger API 재사용 + 필터만 추가한다.
- 제안: 이미 충족됨.

---

## 요약

target 은 기존 spec Rationale 의 핵심 원칙들(EIA client consumer 원칙 R5, 외형 백엔드 미저장 비목표, iframe 격리 R1/R8, co-deploy 버전 전략)을 전반적으로 잘 인식하고 있으며, 비목표 경계 명확화와 env 신설 근거를 자체 Rationale 블록에 기술하는 등 연속성 관리가 대체로 양호하다. 다만 `0-architecture §R8` 의 "iframe 은 반드시 다른 origin 의 실제 src여야 한다"는 invariant 문언이 고객 임베드 맥락으로 한정됨을 원본 spec에 명기하지 않은 채 target 만의 설명으로 예외를 처리하고 있어, 이 부분은 `0-architecture §R8`(또는 신규 `5-admin-console §Rationale`)에 예외 범위를 명시적으로 추가해야 연속성이 완결된다. 나머지 발견사항은 INFO 수준의 보완 제안이다.

---

## 위험도

LOW
