# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/6-config.md`
관련 plan: `plan/in-progress/spec-sync-config-gaps.md`

---

### 발견사항

- **[WARNING]** §A.3 "결정 필요" 항목 3건이 plan 에서 미해소 상태
  - target 위치: `spec/2-navigation/6-config.md` §A.3 (호출 이력 테이블 — 소스 IP·응답 코드 컬럼, 기간별 호출 수)
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` §"미구현 — 결정 필요 / 후속" 3항목
  - 상세:
    - **소스 IP 컬럼** — `hooks.service.ts` 가 `extractClientIp` 로 추출만 하고 미저장. 스키마(컬럼/별도 call-log)·캡처 경로 미결정.
    - **응답 코드 컬럼** — HTTP code vs status enum 의미 + 저장 스키마 미결정.
    - **기간별 호출 수 (일/주/월)** — 롤링 윈도 vs 캘린더 버킷·숫자 vs 차트 표시 형식 미결정.
  - 평가: target spec 자체는 이 세 항목을 "🚧 미구현 (Planned)" / "미구현 / Planned" 로 표기하고 있어 일방적 결정을 내리고 있지 않다. 그러나 impl-prep 착수 범위가 §A.3 을 포함할 경우 위 결정을 우회할 위험이 있다.
  - 제안: 구현 착수 전 §A.3 세 항목이 이번 impl 범위에 포함되는지 확인한다. 포함된다면 plan §"미구현 — 결정 필요" 의 각 항목에 결정 내용을 기재한 후 착수해야 한다. 포함되지 않는다면 (§A.3 을 이번 PR 범위에서 제외하고 §A.2 편집 폼 후속 또는 §A.3 데이터 캡처만 다루는 경우) 별도 주의 없이 진행 가능.

- **[INFO]** God Component 분리 후속 항목이 plan 에 등재됨 — 이번 impl 이 `authentication/page.tsx` 를 추가 수정할 경우 후속 분리 스코프 재조정 필요
  - target 위치: `spec/2-navigation/6-config.md` §A.2 (편집 폼 구현 현황 callout)
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` §"후속 — God Component 분리" (ai-review 2026-06-14 WARNING 1·4)
  - 상세: `authentication/page.tsx` God Component 분리가 후속 PR 로 예약돼 있다. 이번 impl 이 같은 파일을 또 수정하면 후속 리팩토링 스코프가 커지거나 충돌 가능성이 있다.
  - 제안: 이번 impl 이 `authentication/page.tsx` 를 건드릴 경우 plan §"후속 — God Component 분리" 에 추가 변경 범위를 메모로 남긴다.

- **[INFO]** `auth-config-webhook-followups.md` §3 spec 보완 항목(project-planner 영역) 중 일부가 `spec/5-system/12-webhook.md` 및 `spec/5-system/1-auth.md` 에 pending 중
  - target 위치: 해당 없음 (target 은 `6-config.md`, 영향 spec 은 `1-auth.md`·`12-webhook.md`)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §3
  - 상세: `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가, `12-webhook.md` IP 추출 정책 명시 등이 미완. 그러나 이는 target spec(`6-config.md`)이 아닌 인접 spec 의 미완이라 target 직접 충돌은 없다.
  - 제안: 이번 impl 이 `reveal` 또는 IP whitelist 관련 로직을 수정할 경우 위 pending spec 항목과의 정합 여부를 구현 완료 후 `--impl-done` 단계에서 재확인한다.

---

### 요약

`spec/2-navigation/6-config.md` 를 대상으로 하는 `--impl-prep` 검토에서 CRITICAL 충돌은 없다. Target spec 은 §A.3 의 미결정 항목(소스 IP·응답 코드·기간별 호출 수)을 "Planned/미구현"으로 정직하게 표기하고 있고, 관련 plan(`spec-sync-config-gaps.md`)도 이를 "결정 필요"로 열거해 양측이 정합한다. 단, 이번 impl 착수 범위가 §A.3 의 세 항목을 포함할 경우 plan 의 미해결 결정을 먼저 채워야 한다는 WARNING 이 있다. §A.3 을 제외하고 진행하는 경우 발견된 장애물은 없다.

---

### 위험도

LOW
