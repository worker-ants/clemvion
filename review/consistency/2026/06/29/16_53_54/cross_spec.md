### 발견사항

- **[WARNING]** `i18n-userguide.md` Principle 7 본문 — GUI 흐름 절 판별 정의가 두 spec 간 표현 불일치
  - target 위치: target draft `## Principle 7` 자동 검출 항목 (GUI 흐름 절 판별 정의)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/user-guide-evidence.md` §2 `integrations-coverage.test.ts` 행
  - 상세: target draft 의 Principle 7 은 GUI 흐름 절 판별을 `findGuiFlowSections()` + "두 신호 OR: (1) h2/h3 heading 텍스트에 bareword GUI 포함, 또는 (2) 절 본문에 GUI 를 포함한 bold strong" 으로 기술한다. 이는 `user-guide-evidence.md §2` 의 정의와 일치한다. 반면 현재 저장된 `spec/conventions/i18n-userguide.md` (line 172) 는 더 오래된 표현인 "가이드 본문이 `**GUI ...**` strong 패턴으로 시작하거나 heading 에 `GUI` 키워드를 가진 절"로 기술돼 있다. target draft 가 adopt 되면 `i18n-userguide.md` 의 Principle 7 정의가 `user-guide-evidence.md` 와 정합하게 된다 — 즉 target draft 가 실제로 현 파일을 업데이트하는 의도를 가진 경우라면 충돌이 아닌 정합화이며, 단순히 draft 로 검토 중이라면 아래 제안이 적용된다.
  - 제안: target draft 를 채택(파일에 적용)하면 충돌이 해소된다. 채택 전에는 `spec/conventions/i18n-userguide.md` line 172 의 구 판별 정의가 `user-guide-evidence.md` §2 정의와 엄밀히 다르다 — `user-guide-evidence.md` 를 SoT 로 확정한다면 `i18n-userguide.md` Principle 7 본문을 target draft 내용으로 갱신해야 한다.

- **[WARNING]** `자동 가드 요약` 테이블의 Principle 7 행 — guard 위치·종류 기술이 기존 파일에서 누락
  - target 위치: target draft `## 자동 가드 요약` 표 마지막 행 `7 (페이지 stale) | GUI 흐름 절: impl-anchor-existence.test.ts / integrations-coverage.test.ts / triggers-coverage.test.ts (SoT: user-guide-evidence.md). 개념 설명 절: — | hard fail (GUI 흐름 절) / manual (개념 설명 절)`
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/i18n-userguide.md` line 189 `| 7 (페이지 stale) | — | manual / reviewer |`
  - 상세: 기존 파일의 Principle 7 행은 가드 위치를 `—`, 종류를 `manual / reviewer` 로 기록해 세 자동 가드(`impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts`)가 이미 hard fail 을 강제하고 있음을 반영하지 않는다. target draft 는 이를 올바르게 갱신하려는 의도다. 두 버전이 동시에 존재하면 개발자가 Principle 7 이 완전히 manual 이라고 오해하는 위험이 있다.
  - 제안: `i18n-userguide.md` §자동 가드 요약 Principle 7 행을 target draft 내용으로 갱신. `user-guide-evidence.md §5` 에서 이미 "후속으로 i18n-userguide.md §Principle 7 본문에 본 가드의 부분 커버 범위를 명시한다"고 예고하고 있으므로, 해당 약속 이행 작업이 target draft 다.

- **[INFO]** `Principle 7` 본문 — `user-guide-evidence.md §5` 의 "후속 명시 예고" 미반영 상태가 기존 파일에 잔존
  - target 위치: target draft Principle 7 전체 (부분 커버 범위 명시 포함)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/user-guide-evidence.md` line 160 "후속으로 i18n-userguide.md §Principle 7 본문에 본 가드의 부분 커버 범위를 명시한다."
  - 상세: `user-guide-evidence.md §5` 는 이 동기화 작업이 이뤄질 것임을 예고하고 있다. target draft 가 채택되면 이 예고 문구가 완료된 사항이 되므로, `user-guide-evidence.md §5` 의 해당 문장("후속으로 … 명시한다")을 현재형으로 갱신하거나 제거하는 것이 명명 일관성 면에서 바람직하다.
  - 제안: target draft 채택 후 `/Volumes/project/private/clemvion/spec/conventions/user-guide-evidence.md` §5 마지막 문장을 "i18n-userguide.md §Principle 7 에 커버 범위가 반영돼 있다." 등으로 갱신.

---

### 요약

target 문서(`spec/conventions/i18n-userguide.md` draft)는 기존 spec 과 직접 모순을 일으키는 CRITICAL 충돌은 없다. 발견된 두 WARNING 은 모두 **기존 `i18n-userguide.md` 가 `user-guide-evidence.md` 도입 이후 동기화되지 않은 채 잔존하는 stale 상태**를 target draft 가 바로잡으려는 것으로, target draft 채택 자체가 충돌 해소 수단이다. 단, target draft 가 단순 검토 중인 상태라면 현재 두 파일(`i18n-userguide.md` 구버전 vs `user-guide-evidence.md`)은 Principle 7 GUI 흐름 절 판별 정의와 가드 요약 테이블에서 비일관성이 존재한다. 추가로 `user-guide-evidence.md §5` 의 "후속 명시" 예고 문장이 target draft 채택 후 stale 이 되므로 함께 갱신하는 것이 권장된다.

### 위험도

LOW
