# 신규 식별자 충돌 검토 — `spec-draft-nullable-notation-followups.md`

## 검토 범위 요약

target 문서는 세 건의 정정을 담고 있으며, 성격상 대부분 **새 식별자를 도입하지 않는 notation/문면
정정**이다.

- ① `spec/1-data-model.md` §2.9 — 기존 컬럼 `next_run_at` 의 표기(`Timestamp` → `Timestamp?`)만 정정. 새 필드·엔티티 없음.
- ② `spec/5-system/2-api-convention.md` §2.2 — 새 "예외" 행 1건 추가. 새 endpoint 는 아니고 **기존에 이미 존재하는 20개 verb-style 경로**를 규칙 예외로 성문화.
- ③ `spec/5-system/2-api-convention.md` §5.4 — 기존 DTO 선언 규칙 문면을 두 케이스로 분리 정정. 새 타입/엔티티 없음.

실측 결과 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·파일 경로 축에서는 충돌이
발견되지 않았다. 유일하게 주목할 것은 ②가 추가하는 예외 행의 **명칭이 기존 예외 행과 유사**해
생기는 혼동 가능성이다.

---

### 발견사항

- **[WARNING]** §2.2 신규 예외명 "인증 액션 네임스페이스"가 기존 예외명 "인증 family 전용 네임스페이스"와 유사해 혼동 가능
  - target 신규 식별자: `예외 — 인증 액션 네임스페이스` (`/api/auth/{action}` 대상, target §78행)
  - 기존 사용처: `spec/5-system/2-api-convention.md:54` `예외 — 인증 family 전용 네임스페이스` (`/api/external/{resource}` 대상, 이미 존재)
  - 상세: 두 예외 행 모두 "인증"으로 시작하고 "네임스페이스"로 끝나는 이름 패턴을 쓰지만, 가리키는
    대상은 서로 다르다 — 기존 것은 `/api/external/*` (execution 단명 토큰 `iext_*` family, 인증
    **주체/토큰 종류**가 다르다는 이유의 예외), 신규 것은 `/api/auth/*` (자원 CRUD 가 아닌 상태
    전이라는 이유의 예외). §2.2 표는 이제 "RPC-style sub-channel action" · "인증 family 전용
    네임스페이스" · "인증 액션 네임스페이스" 세 행이 나란히 놓이는데, 뒤 두 행의 이름이 한 눈에
    구분되지 않아 표를 훑는 독자(특히 이 규칙을 근거로 새 endpoint 경로를 판단하는 개발자)가
    "인증 관련이니 같은 예외"로 오인해 잘못된 근거(`/api/external/*` 의 토큰 family 사유)로
    `/api/auth/*` 신설 경로를 정당화하거나 그 반대로 혼동할 위험이 있다.
  - 제안: 신규 예외명에서 "인증"이라는 공유 접두를 제거해 대상을 명확히 구분한다. 예:
    `예외 — 인증 상태 전이 액션` 또는 `예외 — 자원 없는 액션(auth)`. 기존 행과 이름이 겹치지
    않으면서 "자원 CRUD 가 아니라 액션을 호출한다"는 신규 예외의 실제 근거를 이름에 반영하는
    편이 혼동을 줄인다.

- **[INFO]** §2.2 예외 카운트 서술("두 예외")이 target 반영 후 stale 해질 잠재 지점 없음(확인됨) — 참고용
  - target 신규 식별자: 세 번째 예외 행 추가
  - 기존 사용처: `plan/in-progress/entity-nullable-column-type-mismatch.md:192` `"§2.2 명명 규칙의 명시된 두 예외(RPC-style `{id}` 필수 / `/api/external/*`)"`
  - 상세: `spec/5-system/2-api-convention.md` 본문 자체는 예외 개수를 문장으로 세지 않으므로(표
    행으로만 나열) target 반영 후 스스로 모순되는 지점은 없다. 다만 위 plan 파일은 "두 예외"라고
    명시적으로 세고 있어, target 반영 후에는 그 plan 문서 쪽 서술이 stale 해진다 — 신규 식별자
    충돌은 아니지만 부수 효과로 남긴다.
  - 제안: 별도 조치 불요(이 checker 스코프 밖). 필요 시 `entity-nullable-column-type-mismatch.md`
    쪽에서 "두 예외" 서술을 갱신하는 것은 그 plan 소유자의 몫.

---

### 요약

target 이 세 건 중 실질적으로 "새 식별자"를 도입하는 곳은 ②의 예외 행 이름뿐이며, 나머지(①③)는
기존 컬럼·기존 DTO 규칙의 표기를 정정하는 것이라 새 엔티티·endpoint·이벤트·환경변수·파일 경로
충돌은 발견되지 않았다(요구사항 ID·엔티티/DTO명·endpoint·이벤트명·ENV/설정키·파일 경로 6개 축
모두 실측 확인 — `next_run_at` 은 `schedule` 테이블 단일 의미로만 쓰이고, 신규 plan 파일 경로
`spec-draft-nullable-notation-followups.md` 도 `spec-draft-*` 명명 컨벤션에 부합하며 기존 파일과
겹치지 않는다). 유일한 이슈는 ②가 추가하는 "인증 액션 네임스페이스" 예외명이 §2.2 에 이미 있는
"인증 family 전용 네임스페이스" 예외명과 표면적으로 유사해, 같은 표 안에서 서로 다른 대상
(`/api/auth/*` vs `/api/external/*`)을 가리키면서도 이름만으로는 구분되지 않는다는 점이다 —
CRITICAL 은 아니지만(의미가 실제로 상충하지는 않음) 명명 명확화를 권장한다.

### 위험도

LOW
