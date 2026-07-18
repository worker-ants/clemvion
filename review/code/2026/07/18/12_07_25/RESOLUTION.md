# RESOLUTION — 12_07_25 (최종 확인 라운드, 수렴)

**판정: 수렴 (BLOCK 없음).** Critical 0, WARNING 1(비-행동·비-긴급). 이 라운드는 라운드4 fix
(explicitFilterCalls 따옴표 span 제거 + 마지막 인라인 비교 2개 추출)의 확인 라운드다. 이전 4개
라운드에서 제기된 **행동(behavioral) 관련 WARNING 은 전부 해소됐고 재지적되지 않았다.**

## WARNING#1 (maintainability) — 모듈 3개 파싱 도메인 혼재 → **의도적 defer**

`internal-package-registration-guard.ts`(304줄)에 bash 파싱·YAML 서브셋 파싱·diff 비교 3개 도메인이
공존한다는 지적. **채택하지 않고 defer** — 근거:

- 리뷰어 자신이 "즉시 강제할 정도는 아니며, 다음 확장(5번째 등록 목록) 시점에 재검토" 로 명시.
- 소비처가 **테스트 파일 1개**뿐이고 목적이 단일(#968 클래스 drift 차단)이라, 지금 3개 파일로
  쪼개는 것은 단일 소비처 유틸리티의 과분할(YAGNI). 섹션 주석·JSDoc 으로 가독성은 이미 확보됨.
- 이 파일 자체가 직전 라운드(11_25_03 WARNING#2)에서 테스트 파일로부터 분리해 **새로 만든**
  모듈이다. 여기서 다시 3분할하면 다음 라운드가 역방향("단일 가드에 파일 3개는 과설계")을
  지적할 수 있다 — 이 저장소가 문서화한 리뷰 treadmill/무한 표면 실패형.

→ 다음 등록 목록(5번째 내부 패키지 클래스) 추가 시점에 도메인 분할을 재검토한다. 그 전까지는
   단일 응집 모듈 유지가 적절.

## INFO 처리

전부 문서화된 설계 경계이거나 낮은 우선순위. 대표:

- **INFO#5 (따옴표로 감싼 패키지명 `pnpm --filter "@workflow/x"` 미지원)**: 현 `cmd_*` 는 이 스타일을
  안 쓰고, 지원 안 함이 fail-loud(과다검출) 방향이라 안전. explicitFilterCalls 독스트링의 명시된
  경계와 일치 — 미채택.
- **INFO#6 (tsc 컴파일타임 검증 제외)**: `__tests__/` 배치의 의도된 런타임 전용 설계. 45건 vitest
  가 브랜치를 구동해 완화. PR #912 류(no-op 타입가드)와 달리 실제 런타임 검증이 있음 — 미채택.
- **INFO#16 (`fnBody` "닫는 } 미발견" throw 분기 미고정)**: 유효한 테스트 완결성 nit이나, 이미
  다른 4개 실패 분기가 fixture 로 고정돼 있고 이 분기는 방어적 경로다. 이 항목만을 위해 새 커밋을
  내면 본 확인 라운드가 stale 해져 재리뷰 사이클이 재개되므로, 수렴 우선으로 **defer**(향후
  touch 시 함께 반영).
- 나머지(top-level fs·describe I/O·MAX_DEPTH·경로 주석 중복·멀티라인 continuation·flow-style YAML)는
  전부 문서화된 fail-loud 경계 — 미채택.

## 수렴 근거

5개 라운드에 걸쳐 행동 관련 지적은 모두 해소·mutation 실측됐고, 잔여 표면은 (a) 조직/스타일
선호(모듈 분할)와 (b) 문서화된 fail-loud 경계뿐이다. 남은 유일한 미해결 무한 표면(셸 따옴표
병리 구문)은 explicitFilterCalls 독스트링에 "별도 파서의 영역, 여기서 다루지 않음"으로 명시
경계했다(#970 교훈). 추가 라운드는 이 저장소가 경고하는 treadmill 이므로 여기서 수렴한다.

## 라운드별 행동 WARNING 해소 이력

| 라운드 | 행동 WARNING | 해소 |
|---|---|---|
| 10_43_59 | fnBody heredoc early-close 미검출 · 파서 true-positive 미고정 | heredoc throw + 합성 fixture (86de33a32) |
| 11_11_24 | discoverPackages/backendWorkflowDeps fixture 갭 | fs 코어 분리 + fixture (e210032c8) |
| 11_25_03 | explicitFilterCalls 주석/echo false-pass | 명령위치 판정 (f82b3a4c8) |
| 11_46_44 | explicitFilterCalls 따옴표 내 구분자 누출 · 마지막 인라인 비교 갭 | 따옴표 span 제거 + 비교 2개 추출 (cb6ee2519) |
| 12_07_25 | (없음) | — |
