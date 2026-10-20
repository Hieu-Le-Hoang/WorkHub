/**
 * Shared types and enums for Dataverse services
 */

// Enum Loai Dang Ky
export enum RegistrationType {
    NghiPhep = 191920000,
    LamViecTaiNha = 191920001,
    TangCa = 191920002,
    CongTac = 191920003,
    DiTreVeSom = 191920004,
    NghiKhongLuong = 283640001
}

export enum ApprovalStatus {
    ChuaDuyet = 191920000,
    DaDuyet = 191920001,
    TuChoi = 191920002
}

export enum HinhThucRegistration {
    NghiPhepNam = 191920000,
    NghiKhongLuong = 191920001,
    NghiThaiSan = 191920002,
    NghiKetHon = 191920003,
    NghiTangChe = 191920004,
    NghiPhepTruGioOT = 191920015,
    TangCaSauGioLam = 191920005,
    TangCaNgayNghi = 191920013,
    TangCaNgayLeTet = 191920006,
    TangCaTrucDon = 191920007,
    TangCaNghiBu = 191920014,
    SaleonlineTangCaTrucHangTuan = 191920008,
    ViecCongTy = 191920009,
    LamBuTrongThang = 191920010,
    TruLuong = 191920011,
    ThieuCheckinCheckout = 191920012,
    CongTacSale = 191920016,
    CongTacVanPhong = 191920017,
    NghiNuoiConDuoi12Thang = 191920018,
    TangCaKhongNhanLuong = 191920019,
    ThienTaiDaiDich = 283640001
}

// Interface cho data từ Dataverse
export interface DataverseChamCong {
    crdfd_bangchamconghangngayid: string;
    crdfd_ngay: string;
    crdfd_checkin?: string;
    crdfd_checkout?: string;
    registration?: {
        id: string;
        type: number;
        typeName: string;
        hours: number;
        status: string;
    };
    crdfd_sogiolam?: number;
    crdfd_trangthai?: string;
    crdfd_ghichu?: string;
    _crdfd_tennhanvien_value?: string;
    statecode: number;
}

// Interface Phieu Dang Ky
export interface PhieuDangKy {
    crdfd_phieuangkyid: string;
    _crdfd_nhanvien_value: string;
    crdfd_loaiangky: number;
    crdfd_tungay: string;
    crdfd_enngay: string;
    crdfd_sogio2?: number;
    crdfd_diengiai?: string;
    crdfd_captrenduyet?: number;
    crdfd_hinhthuc?: number;
    crdfd_quanlytructiep?: string;
    cr1bb_songay?: number;
    cr1bb_sopheptonnamtruoc?: number;
    new_sophepconlaitoithangthucte?: number;
    statecode: number;
}

export interface TeamRegistration extends PhieuDangKy {
    employeeName: string;
    employeeCode?: string;
}

export interface DNTTRecord {
    cr44a_enghithanhtoanid: string;
    cr1bb_loaihosothanhtoan?: string;
    cr44a_sotien_de_nghi?: number;
    cr1bb_diengiai?: string;
    cr1bb_ngaydukienthanhtoan?: string;
    cr44a_trangthai_denghithanhtoan?: string;
    cr44a_truongbophan?: string;
    cr44a_truongbophan_value?: number;
    cr44a_ketoanthanhtoan?: string;
    cr44a_ketoantonghop?: string;
    _ownerid_value?: string;
    ownerName?: string;
    createdon?: string;
    statecode: number;
}
