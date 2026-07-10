### 발견사항

- **[INFO]** 게이트 재검증 결과 기록 — 이전 CRITICAL(round 15_29_25) 은 change 1b 재작성으로 구조적으로 해소됨, 별도 조치 불요
  - target 위치: `plan/in-progress/catalog-residual-codes.md` 변경 1b (§2.3 **본문** blockquote 신설), 변경 2a (`INVALID_PASSWORD` 카탈로그 행의 도메인 SoT 링크)
  - 과거 결정 출처: `spec/5-system/1-auth.md` §2.3(본문) L334 `> **재인증 에러 코드**` blockquote 선례 + `spec/5-system/3-error-handling.md` `## Rationale`(L477) "코드에만 존재하고 도메인 spec **본문** 미문서였던 재인증 세부 코드는... 'spec 문서화 → 등재' 순서의 후속으로 남겼고" + 동일 문서 §1.2.1 하단 주석(L67, 정정 대상 원문)
  - 상세: round 15_29_25 CRITICAL 은 "change 1b 가 `§2.3.C`(`## Rationale` 절 내부, L675~692)만 보강해 게이트가 요구하는 '본문 배치' 요건을 여전히 충족하지 못한다"는 구조적 문제를 지적했다. 이번 draft 의 change 1b 는 그 CRITICAL 의 제안을 사실상 그대로 채택했다:
    1. `spec/5-system/1-auth.md` 실측 결과 `## Rationale` 은 여전히 L506 에서 시작한다(§2.3.C 는 L675, 여전히 Rationale 절 내부) — 이 구조는 안 바뀌었다.
    2. 그러나 새 blockquote(`> **비밀번호 변경 실패 코드**: ...`)는 §2.3.C 를 수정하는 것이 아니라, §2.3 재인증 코드 note(L334, 본문·`## 2. 세션 관리` 하위)의 **바로 뒤**, 즉 `### 2.4 토큰 갱신 플로우`(L336) 이전 — 여전히 "본문" 헤딩 트리 안 — 에 별도로 신설된다. 결과적으로 §2.3 본문에 두 개의 병렬 blockquote(재인증 코드 note, 비밀번호 변경 실패 코드 note)가 나란히 존재하는 구조가 되어, §2.3.D(Rationale) 가 §2.3(본문)을 재인증 세부 코드의 SoT 로 승격시킨 것과 동일한 패턴을 `INVALID_PASSWORD` 에도 대칭 적용한다.
    3. 카탈로그 링크(변경 2a)도 `[1-auth.md §2.3.C]` 가 아니라 `[1-auth.md §2.3](./1-auth.md#23-세션-정책)` 로 정정되어, `PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_REQUIRED`(기존 §1.2.1 행, 모두 동일 앵커 `#23-세션-정책` 사용)와 앵커 형식이 완전히 일치한다. `3-error-handling.md` 전체 카탈로그가 "도메인 spec 의 번호 매겨진 본문 절"만 SoT 로 인용하는 기존 관행(§1.4.3·§5·§7.1 등, 예외 없음)과도 이제 어긋나지 않는다.
    4. round 15_29_25 이 제시한 구체 대안 문구("`> **비밀번호 변경 실패 코드**` blockquote 노트를 §2.3 직후(본문)에 신설")와 실제 change 1b 신설 blockquote 문구를 대조하면 의미·위치가 사실상 동일하다 — 제안이 문자 그대로 반영됐다.
  - 제안: 조치 불요. 다만 향후 재검토자의 추적 비용을 줄이려면, "핵심 배치 결정" 단락(현재 `PASSWORD_REQUIRED` 형제 분리 CRITICAL 반영만 명시)에 "`INVALID_PASSWORD` 의 본문 배치는 rationale_continuity round 15_29_25 CRITICAL(§2.3.C→§2.3 본문 blockquote 전환)을 반영" 한 문장을 덧붙이면 provenance 가 한 곳에 모인다 — 선택 사항.

- **[INFO]** §2.3.C(Rationale) 의 기존 `INVALID_PASSWORD` 언급(L690)과 신규 본문 blockquote(1b)의 관계가 plan 텍스트에 명시되지 않음
  - target 위치: `plan/in-progress/catalog-residual-codes.md` 변경 1b
  - 과거 결정 출처: `spec/5-system/1-auth.md` §2.3.C 기존 문장(L690) — "**OAuth-only 사용자**: `passwordHash` 가 없으면 `POST /users/me/change-password` 자체가 `INVALID_PASSWORD` 로 차단되므로(현행) 본 정책은 비밀번호 보유 사용자에만 적용된다."
  - 상세: 이 문장은 round 15_05_50/15_29_25 가 "지나가는 언급(passing mention)"으로 지목했던 그 원문이다. 신규 본문 blockquote(1b)가 정식 SoT 가 된 이후에도 이 문장 자체는 그대로 유지되는데, 두 서술이 내용상 모순되지는 않는다(L690 은 "비밀번호 미보유자는애초에 change-password 호출이 차단된다"는 §2.3.C 정책의 전제 설명이고, 신규 blockquote 는 코드·status·근접명명 disambiguation 을 다루는 카탈로그 SoT) — 다만 두 곳에 `INVALID_PASSWORD` 트리거 조건(미설정 OAuth-only)이 부분 중복 서술된다.
  - 제안: 내용 충돌이 없어 CRITICAL/WARNING 은 아니다. 원한다면 L690 뒤에 "(정식 코드·status 문서화는 §2.3 본문 note 참조)" 한 구절만 추가해 두 서술의 관계(전제 설명 vs 카탈로그 SoT)를 명시하면 향후 drift 위험이 더 줄어든다.

### 요약
이번 라운드에서 재작성된 change 1b 는 round 15_29_25 가 지적한 CRITICAL("`INVALID_PASSWORD` 문서화가 `## Rationale` 절 내부의 §2.3.C 에 머물러 게이트가 요구하는 '본문 배치' 요건을 구조적으로 충족하지 못함")을 실제 spec 헤딩 구조 기준으로 해소한다. `spec/5-system/1-auth.md` 실측 결과 §2.3.C 는 여전히 `## Rationale`(L506~) 내부에 위치하지만, 새 blockquote 는 §2.3.C 를 건드리지 않고 §2.3 본문(`## 2. 세션 관리` 하위, 기존 재인증 코드 note L334 바로 뒤)에 별도 신설되어, 재인증 세부 코드(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`)가 §2.3.D(Rationale)를 통해 §2.3(본문)을 SoT 로 승격시킨 선례와 동형 구조를 이룬다. 카탈로그(변경 2a)의 도메인 SoT 링크도 `§2.3.C` 에서 `§2.3`(`#23-세션-정책`, 기존 형제 코드 3종과 동일 앵커)으로 정정되어 `3-error-handling.md` 전체의 "본문 절만 인용" 관행과 정합한다. 세 코드 전부 — `NOT_A_MEMBER`(§5 본문, 기존 등재 유지)·`PASSWORD_REQUIRED`(§5 본문 blockquote, 1a — 이전 라운드에서 이미 확인된 상태 변화 없음)·`INVALID_PASSWORD`(§2.3 본문 blockquote, 1b 신규) — 가 "spec 문서화(본문) → 카탈로그 등재" 게이트를 충족한다. round 15_05_50 의 두 INFO(§1.3→§1.2 재배치 근거 명문화, `error-codes-catalog-sot.md` 체크리스트 `PASSWORD_REQUIRED` 누락)도 현재 draft 의 2d bullet·워크플로 체크리스트에 이미 반영되어 회귀가 없다. 이번 라운드에서 새로 발견된 사항은 모두 INFO(선택적 provenance 명문화·경미한 서술 중복 안내)이며, 기각된 대안의 재도입·합의 원칙 위반·무근거 결정 번복·invariant 우회에 해당하는 CRITICAL/WARNING 은 없다.

### 위험도
NONE
